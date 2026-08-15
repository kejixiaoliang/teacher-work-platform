import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ensureDataLayout, getDataDir } from './config/paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 测试或便携运行时可指定独立数据目录，默认仍使用项目内 data 目录。
const dataDir = getDataDir();
ensureDataLayout();

const dbFile = path.join(dataDir, 'teacher.db');
// 记录启动时是否为全新数据库（用于首次启动才写示例数据，避免用户删光班级后重启"复活"演示数据）
const isFreshDb = !fs.existsSync(dbFile);

const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export const DATABASE_VERSION = 4;
const openingVersion = db.pragma('user_version', { simple: true });
if (!isFreshDb && openingVersion < DATABASE_VERSION) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const recoveryDir = path.join(dataDir, 'backups', `before-db-v${openingVersion}-to-v${DATABASE_VERSION}-${stamp}`);
  fs.mkdirSync(recoveryDir, { recursive: true });
  const recoveryFile = path.join(recoveryDir, 'teacher.db');
  db.prepare('VACUUM INTO ?').run(recoveryFile);
  fs.writeFileSync(path.join(recoveryDir, 'backup.json'), JSON.stringify({
    type: 'before-upgrade',
    fromDatabaseVersion: openingVersion,
    toDatabaseVersion: DATABASE_VERSION,
    createdAt: new Date().toISOString(),
  }, null, 2));
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
  follow_up_status TEXT DEFAULT '正常',
  follow_up_note TEXT DEFAULT '',
  follow_up_updated_at TEXT,
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
  source TEXT DEFAULT '学期存档',
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
-- 唯一索引由 migrate() 在去重后创建（先删重复再建索引，防止旧库启动即抛约束错误）
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

CREATE TABLE IF NOT EXISTS leaves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT '事假',
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT NOT NULL DEFAULT '',
  days REAL DEFAULT 1,
  reason TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT '已批准',
  remark TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_leaves_class ON leaves(class_id);
CREATE INDEX IF NOT EXISTS idx_leaves_student ON leaves(student_id);
CREATE INDEX IF NOT EXISTS idx_leaves_class_dates ON leaves(class_id, start_date, end_date);

CREATE TABLE IF NOT EXISTS assessment_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS assessment_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES assessment_categories(id),
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  allow_daily_repeat INTEGER NOT NULL DEFAULT 0,
  description TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime')),
  UNIQUE(category_id, name)
);

CREATE TABLE IF NOT EXISTS assessment_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES assessment_items(id) ON DELETE SET NULL,
  category_name_snapshot TEXT NOT NULL,
  item_name_snapshot TEXT NOT NULL,
  score_snapshot INTEGER NOT NULL,
  behavior_date TEXT NOT NULL,
  remark TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'voided')),
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS assessment_record_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_id INTEGER NOT NULL REFERENCES assessment_records(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK(action IN ('edit', 'void', 'restore')),
  before_json TEXT NOT NULL,
  after_json TEXT NOT NULL,
  changed_fields_json TEXT NOT NULL DEFAULT '[]',
  reason TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

-- 常用查询索引（P2-16）：必须在所有建表之后，否则全新库会报 no such table
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_documents_class ON documents(class_id);
CREATE INDEX IF NOT EXISTS idx_duties_class ON duties(class_id);
CREATE INDEX IF NOT EXISTS idx_seat_layouts_class ON seat_layouts(class_id);
CREATE INDEX IF NOT EXISTS idx_metrics_student ON student_metrics_history(student_id);
CREATE INDEX IF NOT EXISTS idx_records_student ON student_records(student_id);
CREATE INDEX IF NOT EXISTS idx_contacts_student ON contacts(student_id);
CREATE INDEX IF NOT EXISTS idx_scores_exam ON exam_scores(exam_id);
CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON attendance(class_id, date);
-- 外键子表按 student_id 的级联删除/查询索引（P2-21）
CREATE INDEX IF NOT EXISTS idx_seats_student ON seats(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_scores_student ON exam_scores(student_id);
CREATE INDEX IF NOT EXISTS idx_duties_student ON duties(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_assessment_items_category ON assessment_items(category_id);
CREATE INDEX IF NOT EXISTS idx_assessment_records_class_date ON assessment_records(class_id, behavior_date);
CREATE INDEX IF NOT EXISTS idx_assessment_records_student_date ON assessment_records(student_id, behavior_date);
CREATE INDEX IF NOT EXISTS idx_assessment_records_item_date ON assessment_records(item_id, behavior_date);
CREATE INDEX IF NOT EXISTS idx_assessment_records_batch ON assessment_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_assessment_revisions_record ON assessment_record_revisions(record_id);
`);

// ===== 迁移（必须在建表之后，且一次性迁移用 user_version 标记，避免重复执行） =====
function migrate() {
  // v1：旧库 classes 补 aisle_mode 列（新建库建表语句已含该列，这里只对旧库生效）
  if (db.pragma('user_version', { simple: true }) < 1) {
    const clsCols = db.prepare('PRAGMA table_info(classes)').all().map(c => c.name);
    if (!clsCols.includes('aisle_mode')) {
      db.exec('ALTER TABLE classes ADD COLUMN aisle_mode INTEGER DEFAULT 1');
    }
    // 一次性清理：同班同名重复考试，保留每组最新一条（成绩随级联删除）。
    // 放在 user_version 迁移里，避免每次启动都无条件删数据。
    db.exec(`
      DELETE FROM exams WHERE id NOT IN (
        SELECT MAX(id) FROM exams GROUP BY class_id, name
      );
      -- 必须先删除重复数据再建唯一索引，否则旧库启动即抛 SQLITE_CONSTRAINT
      CREATE UNIQUE INDEX IF NOT EXISTS idx_exams_class_name ON exams(class_id, name);
    `);
    db.pragma('user_version = 1');
    console.log('[migrate] 数据库迁移完成 → user_version 1');
  }
  if (db.pragma('user_version', { simple: true }) < 2) {
    const studentCols = db.prepare('PRAGMA table_info(students)').all().map(c => c.name);
    if (!studentCols.includes('follow_up_status')) db.exec("ALTER TABLE students ADD COLUMN follow_up_status TEXT DEFAULT '正常'");
    if (!studentCols.includes('follow_up_note')) db.exec("ALTER TABLE students ADD COLUMN follow_up_note TEXT DEFAULT ''");
    if (!studentCols.includes('follow_up_updated_at')) db.exec('ALTER TABLE students ADD COLUMN follow_up_updated_at TEXT');
    db.pragma('user_version = 2');
    console.log('[migrate] 学生跟进字段迁移完成 → user_version 2');
  }
  if (db.pragma('user_version', { simple: true }) < 3) {
    const metricCols = db.prepare('PRAGMA table_info(student_metrics_history)').all().map(c => c.name);
    if (!metricCols.includes('source')) db.exec("ALTER TABLE student_metrics_history ADD COLUMN source TEXT DEFAULT '学期存档'");
    db.pragma('user_version = 3');
    console.log('[migrate] 健康快照来源字段迁移完成 → user_version 3');
  }
  if (db.pragma('user_version', { simple: true }) < 4) {
    const categoryCount = db.prepare('SELECT COUNT(*) AS c FROM assessment_categories').get().c;
    if (categoryCount === 0) {
      const insertCategory = db.prepare('INSERT INTO assessment_categories (name, sort_order) VALUES (?, ?)');
      const insertItem = db.prepare(`
        INSERT INTO assessment_items
          (category_id, name, score, allow_daily_repeat, description, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const seeds = [
        ['课堂表现', [
          ['积极发言', 1, 0, '课堂中主动、有效参与讨论'],
          ['课堂迟到', -1, 0, '未按时进入课堂'],
        ]],
        ['学习习惯', [
          ['按时完成作业', 1, 0, '按要求完成并提交作业'],
          ['未完成作业', -2, 1, '未按要求完成作业'],
        ]],
        ['卫生劳动', [
          ['认真完成值日', 2, 0, '按要求完成分配的卫生劳动'],
          ['值日缺勤', -2, 0, '无故未完成值日任务'],
        ]],
        ['文明纪律', [
          ['课堂扰乱秩序', -2, 1, '影响正常课堂秩序'],
          ['主动帮助同学', 2, 1, '主动帮助同学解决问题'],
        ]],
        ['荣誉表现', [
          ['获得表扬', 3, 1, '获得学校、班级或教师表扬'],
        ]],
      ];
      const seed = db.transaction(() => {
        seeds.forEach(([categoryName, items], categoryIndex) => {
          const category = insertCategory.run(categoryName, categoryIndex);
          items.forEach(([name, score, repeat, description], itemIndex) => {
            insertItem.run(category.lastInsertRowid, name, score, repeat, description, itemIndex);
          });
        });
      });
      seed();
    }
    db.pragma('user_version = 4');
    console.log('[migrate] 学生行为量化表迁移完成 → user_version 4');
  }
}
migrate();

/** 首次启动（全新数据库）时写入示例班级 + 示例学生，方便演示排座。
 *  仅当启动时 data/teacher.db 不存在才写入；可用环境变量 SEED_DEMO=0 强制关闭。 */
export function seedIfEmpty() {
  if (process.env.SEED_DEMO === '0') return;
  if (!isFreshDb) return; // 非全新库（用户删光班级等）不复活演示数据
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
