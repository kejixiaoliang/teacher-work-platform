import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'teacher.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 迁移：classes 表补 aisle_mode 列（已存在的旧库）
const clsCols = db.prepare('PRAGMA table_info(classes)').all().map(c => c.name);
if (!clsCols.includes('aisle_mode')) {
  db.exec('ALTER TABLE classes ADD COLUMN aisle_mode INTEGER DEFAULT 1');
}

db.exec(`
CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  academic_year TEXT DEFAULT '',
  term TEXT DEFAULT '上',
  seat_rows INTEGER DEFAULT 6,
  seat_cols INTEGER DEFAULT 8,
  aisle_mode INTEGER DEFAULT 1,
  head_teacher TEXT DEFAULT '',
  remark TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  school_no TEXT DEFAULT '',
  name TEXT NOT NULL,
  gender TEXT DEFAULT '男',
  birth_date TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  parent_phone TEXT DEFAULT '',
  is_boarding INTEGER DEFAULT 0,
  interest_duty TEXT DEFAULT '',
  health_note TEXT DEFAULT '',
  height_cm REAL,
  vision_left REAL,
  vision_right REAL,
  is_myopia INTEGER DEFAULT 0,
  grade_level TEXT DEFAULT '',
  seat_note TEXT DEFAULT '',
  status TEXT DEFAULT '在读',
  remark TEXT DEFAULT '',
  deleted_at TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_school_no ON students(school_no) WHERE school_no <> '' AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS student_metrics_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  term TEXT DEFAULT '',
  height_cm REAL,
  vision_left REAL,
  vision_right REAL,
  grade_level TEXT DEFAULT '',
  is_myopia INTEGER DEFAULT 0,
  recorded_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS seats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
  row INTEGER NOT NULL,
  col INTEGER NOT NULL,
  locked INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  UNIQUE(class_id, row, col)
);

CREATE TABLE IF NOT EXISTS seat_layouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  rule_snapshot TEXT DEFAULT '{}',
  seats_snapshot TEXT DEFAULT '[]',
  remark TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  category TEXT DEFAULT '',
  size INTEGER DEFAULT 0,
  mime TEXT DEFAULT '',
  tag TEXT DEFAULT '',
  deleted_at TEXT,
  uploaded_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS duties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  group_no INTEGER,
  week_days TEXT DEFAULT '',
  term TEXT DEFAULT '',
  remark TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date TEXT DEFAULT '',
  subjects TEXT DEFAULT '[]',
  remark TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS exam_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  score REAL,
  UNIQUE(exam_id, student_id, subject)
);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT '出勤',
  remark TEXT DEFAULT '',
  UNIQUE(class_id, student_id, date)
);

CREATE TABLE IF NOT EXISTS student_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT '表现',
  content TEXT NOT NULL,
  date TEXT DEFAULT '',
  remark TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  date TEXT DEFAULT '',
  method TEXT DEFAULT '',
  topic TEXT DEFAULT '',
  result TEXT DEFAULT '',
  remark TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
`);

/** 首次启动时写入示例班级 + 示例学生，方便演示排座。表非空则跳过。 */
export function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM classes').get().c;
  if (count > 0) return;

  const cls = db.prepare(`
    INSERT INTO classes (name, academic_year, term, seat_rows, seat_cols, head_teacher, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('2025级1班', '2025-2026', '上', 6, 8, '王老师', '示例班级，可删除后新建');

  const classId = cls.lastInsertRowid;
  const surnames = ['王','李','张','刘','陈','杨','黄','赵','吴','周','徐','孙','马','朱','胡','郭','何','林','高','郑'];
  const names = ['子涵','欣怡','梓萱','浩然','俊杰','雨桐','思远','嘉琪','诗涵','明轩','若曦','宇航','静怡','天佑','一诺','欣妍','子墨','雨泽','雅婷','浩然'];
  const heights = [145, 148, 150, 152, 153, 155, 156, 158, 160, 161, 162, 163, 165, 166, 168, 170, 172, 174, 176, 178];
  const visions = [4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 5.0, 5.0, 5.1, 5.1, 5.2, 5.2, 4.5, 4.8, 4.6, 5.0, 4.7, 5.1];
  const grades = ['优','良','良','中','待提高','优','中','良','优','待提高','良','中','优','良','待提高','中','良','优','中','良'];

  const ins = db.prepare(`
    INSERT INTO students (class_id, school_no, name, gender, birth_date, is_boarding, height_cm, vision_left, vision_right, is_myopia, grade_level, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '在读')
  `);

  const tx = db.transaction(() => {
    for (let i = 0; i < 20; i++) {
      const gender = i % 2 === 0 ? '男' : '女';
      ins.run(
        classId,
        `2025${String(1001 + i)}`,
        surnames[i] + names[i],
        gender,
        `2012-${String((i % 9) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
        i % 3 === 0 ? 1 : 0,
        heights[i],
        visions[i],
        visions[i] >= 5.0 ? visions[i] : Math.min(5.2, visions[i] + 0.1),
        visions[i] < 4.8 ? 1 : 0,
        grades[i]
      );
    }
  });
  tx();
  console.log('[seed] 已写入示例班级与 20 名学生');
}

export default db;
