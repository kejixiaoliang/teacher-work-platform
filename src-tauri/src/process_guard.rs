use std::{
    path::{Path, PathBuf},
    process::{Child, Command},
};

pub fn is_exact_runtime_path(candidate: &Path, expected: &Path) -> bool {
    candidate.to_string_lossy().to_lowercase() == expected.to_string_lossy().to_lowercase()
}

pub struct InstanceGuard {
    #[cfg(windows)]
    handle: usize,
}

impl InstanceGuard {
    pub fn acquire(profile: &str, executable_root: &Path) -> Result<Option<Self>, String> {
        #[cfg(windows)]
        {
            if profile != "installed" {
                return Ok(Some(Self { handle: 0 }));
            }
            let _ = executable_root;
            let name = wide("Local\\TeacherWork-Installed-v1");
            let handle = unsafe {
                windows_sys::Win32::System::Threading::CreateMutexW(
                    std::ptr::null_mut(),
                    1,
                    name.as_ptr(),
                )
            };
            if handle.is_null() {
                return Err("无法创建教师工作台单实例锁".into());
            }
            if unsafe { windows_sys::Win32::Foundation::GetLastError() }
                == windows_sys::Win32::Foundation::ERROR_ALREADY_EXISTS
            {
                unsafe { windows_sys::Win32::Foundation::CloseHandle(handle) };
                return Ok(None);
            }
            return Ok(Some(Self {
                handle: handle as usize,
            }));
        }

        #[cfg(not(windows))]
        {
            let _ = (profile, executable_root);
            Ok(Some(Self {}))
        }
    }
}

#[cfg(windows)]
impl Drop for InstanceGuard {
    fn drop(&mut self) {
        if self.handle != 0 {
            unsafe {
                windows_sys::Win32::Foundation::CloseHandle(
                    self.handle as windows_sys::Win32::Foundation::HANDLE,
                )
            };
        }
    }
}

pub fn cleanup_orphaned_sidecars(executable_root: &Path) -> Result<usize, String> {
    #[cfg(windows)]
    {
        return cleanup_windows_sidecars(executable_root);
    }

    #[cfg(not(windows))]
    {
        let _ = executable_root;
        Ok(0)
    }
}

pub struct ManagedSidecar {
    child: Child,
    #[cfg(windows)]
    _job: JobHandle,
}

impl ManagedSidecar {
    pub fn spawn(command: &mut Command) -> Result<Self, String> {
        let child = command
            .spawn()
            .map_err(|error| format!("无法启动本地服务: {error}"))?;

        #[cfg(windows)]
        {
            let job = match JobHandle::for_child(&child) {
                Ok(job) => job,
                Err(error) => {
                    let mut child = child;
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(error);
                }
            };
            return Ok(Self { child, _job: job });
        }

        #[cfg(not(windows))]
        Ok(Self { child })
    }

    pub fn child_mut(&mut self) -> &mut Child {
        &mut self.child
    }

    pub fn shutdown(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

impl Drop for ManagedSidecar {
    fn drop(&mut self) {
        self.shutdown();
    }
}

#[cfg(windows)]
struct JobHandle(usize);

#[cfg(windows)]
impl JobHandle {
    fn for_child(child: &Child) -> Result<Self, String> {
        use std::{
            mem::{size_of, zeroed},
            os::windows::io::AsRawHandle,
        };
        use windows_sys::Win32::System::JobObjects::{
            AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
            SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
            JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
        };

        let job = unsafe { CreateJobObjectW(std::ptr::null_mut(), std::ptr::null()) };
        if job.is_null() {
            return Err("无法创建后台服务进程组".into());
        }

        let mut limits: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = unsafe { zeroed() };
        limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        let configured = unsafe {
            SetInformationJobObject(
                job,
                JobObjectExtendedLimitInformation,
                &mut limits as *mut _ as *mut _,
                size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            )
        } != 0;
        if !configured {
            unsafe { windows_sys::Win32::Foundation::CloseHandle(job) };
            return Err("无法配置后台服务进程组".into());
        }

        let assigned = unsafe { AssignProcessToJobObject(job, child.as_raw_handle() as _) } != 0;
        if !assigned {
            unsafe { windows_sys::Win32::Foundation::CloseHandle(job) };
            return Err("无法托管后台服务进程".into());
        }
        Ok(Self(job as usize))
    }
}

#[cfg(windows)]
impl Drop for JobHandle {
    fn drop(&mut self) {
        unsafe {
            windows_sys::Win32::Foundation::CloseHandle(
                self.0 as windows_sys::Win32::Foundation::HANDLE,
            )
        };
    }
}

#[cfg(windows)]
fn cleanup_windows_sidecars(executable_root: &Path) -> Result<usize, String> {
    use std::mem::{size_of, zeroed};
    use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };
    use windows_sys::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, TerminateProcess, WaitForSingleObject,
        PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_SYNCHRONIZE, PROCESS_TERMINATE,
    };

    let expected = std::fs::canonicalize(executable_root.join("resources/runtime/node.exe"))
        .map_err(|error| format!("无法定位内置 Node 运行时: {error}"))?;
    let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
    if snapshot == INVALID_HANDLE_VALUE {
        return Err("无法枚举 Windows 进程".into());
    }

    let mut entry: PROCESSENTRY32W = unsafe { zeroed() };
    entry.dwSize = size_of::<PROCESSENTRY32W>() as u32;
    let mut matched = Vec::new();
    let mut has_entry = unsafe { Process32FirstW(snapshot, &mut entry) } != 0;
    while has_entry {
        let process = unsafe {
            OpenProcess(
                PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_TERMINATE | PROCESS_SYNCHRONIZE,
                0,
                entry.th32ProcessID,
            )
        };
        if !process.is_null() {
            let mut buffer = [0u16; 1024];
            let mut length = buffer.len() as u32;
            let queried =
                unsafe { QueryFullProcessImageNameW(process, 0, buffer.as_mut_ptr(), &mut length) }
                    != 0;
            if queried {
                let path = PathBuf::from(String::from_utf16_lossy(&buffer[..length as usize]));
                if is_exact_runtime_path(&path, &expected) {
                    matched.push(process);
                } else {
                    unsafe { CloseHandle(process) };
                }
            } else {
                unsafe { CloseHandle(process) };
            }
        }
        has_entry = unsafe { Process32NextW(snapshot, &mut entry) } != 0;
    }
    unsafe { CloseHandle(snapshot) };

    for process in &matched {
        unsafe {
            let _ = TerminateProcess(*process, 0);
            let _ = WaitForSingleObject(*process, 5000);
            CloseHandle(*process);
        }
    }
    Ok(matched.len())
}

#[cfg(windows)]
fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(test)]
mod tests {
    use super::is_exact_runtime_path;
    use std::path::Path;

    #[test]
    fn matches_only_the_exact_bundled_runtime_path() {
        let expected =
            Path::new(r"C:\Users\tester\AppData\Local\教师工作台\resources\runtime\node.exe");
        assert!(is_exact_runtime_path(
            Path::new(r"c:\users\TESTER\AppData\Local\教师工作台\resources\runtime\NODE.EXE"),
            expected
        ));
        assert!(!is_exact_runtime_path(
            Path::new(r"C:\Program Files\nodejs\node.exe"),
            expected
        ));
        assert!(!is_exact_runtime_path(
            Path::new(r"C:\Users\tester\AppData\Local\教师工作台\resources\runtime\node.exe.bak"),
            expected
        ));
    }
}
