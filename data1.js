// =====================================================================
//  SQL for Backend Engineers — বাংলা ইন্টারঅ্যাক্টিভ গাইড
//  সব কন্টেন্ট এখানে। প্রতিটি chapter = sections + quiz + flashcards
//  section fields: t (title), bn, en, mem (মনে রাখো), code, run (SQLite
//  version for playground), viz (visualization id), trap, tip, iq (interview)
// =====================================================================

const PARTS = [
  { id: 1, bn: "ভিত্তি", en: "Foundations", icon: "🧱" },
  { id: 2, bn: "মূল SQL", en: "Core SQL", icon: "⚙️" },
  { id: 3, bn: "মধ্যবর্তী SQL", en: "Intermediate SQL", icon: "🚀" },
  { id: 4, bn: "অ্যাডভান্সড SQL", en: "Advanced SQL", icon: "🔥" },
  { id: 5, bn: "কুয়েরি অপটিমাইজেশন", en: "Query Optimization", icon: "⚡" },
  { id: 6, bn: "ডিজাইন ও ইন্টারভিউ", en: "Design & Practice", icon: "🎯" },
];

const CHAPTERS = [
// ───────────────────────────── PART I ─────────────────────────────
{
  id: 1, part: 1, icon: "🧠",
  en: "How a Relational Database Thinks", bn: "ডাটাবেস কীভাবে চিন্তা করে",
  pages: "2–4",
  sections: [
    {
      t: "SQL = 'কী চাই' বলো, 'কীভাবে' না",
      bn: "C#/Python-এ তুমি বলো <b>কীভাবে</b> করতে হবে (loop)। SQL-এ তুমি শুধু বলো <b>কী</b> চাও। 'কীভাবে' ঠিক করে <b>Query Optimizer</b> — প্রতিবার, আজকের ডাটার পরিমাণ দেখে।",
      en: "SQL is declarative: you describe WHAT you want; the optimizer invents HOW, fresh every time.",
      mem: "তুমি = অর্ডার দাও 🍔, Optimizer = রাঁধুনি 👨‍🍳। কীভাবে রাঁধবে সেটা রাঁধুনির কাজ।",
      tip: { bn: "একই query ল্যাপটপে fast, production-এ slow? কারণ ডাটার পরিমাণ আলাদা → optimizer আলাদা plan বেছে নেয়।", en: "Same query, different data size → different plan." }
    },
    {
      t: "Table = সাজানো নেই এমন একটা Set",
      bn: "Table হলো rows-এর একটা <b>unordered set</b>। ৩টা নিয়ম:<br>① Row-এর কোনো order নেই (ORDER BY না দিলে)।<br>② 'তৃতীয় row' বলে কিছু নেই।<br>③ Duplicate row = খারাপ ডিজাইন → সব table-এ <b>Primary Key</b> দাও।",
      en: "A table is an unordered set of rows. No ORDER BY = no guaranteed order. Every table needs a primary key.",
      trap: { bn: "\"ORDER BY ছাড়াই ঠিক order-এ আসছে\" — এটা production-এর সবচেয়ে কমন লুকানো bug। Table বড় হলে order হঠাৎ বদলে যাবে।", en: "Order without ORDER BY is an accident of the plan." }
    },
    {
      t: "SELECT-এর Logical Processing Order ⭐",
      bn: "তুমি যে order-এ লেখো, ডাটাবেস সেই order-এ চালায় <b>না</b>! নিচের animation-এ ▶ চাপো — দেখো কোন ধাপে কী হয়। এটা মুখস্থ করলে অনেক 'অদ্ভুত' নিয়ম নিজে থেকেই বোঝা যায়।",
      en: "Written order ≠ execution order. FROM → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → LIMIT.",
      code: `SELECT c.FullName, COUNT(*) AS TxnCount   -- ⑤
FROM Customers AS c                          -- ①
JOIN Accounts AS a ON a.CustomerId = c.CustomerId
JOIN Transactions AS t ON t.AccountId = a.AccountId
WHERE t.TxnDate >= '2026-01-01'              -- ②
GROUP BY c.FullName                          -- ③
HAVING COUNT(*) > 10                         -- ④
ORDER BY TxnCount DESC;                      -- ⑦`,
      run: `SELECT c.FullName, COUNT(*) AS TxnCount
FROM Customers AS c
JOIN Accounts AS a ON a.CustomerId = c.CustomerId
JOIN Transactions AS t ON t.AccountId = a.AccountId
WHERE t.TxnDate >= '2026-01-01'
GROUP BY c.FullName
HAVING COUNT(*) > 2
ORDER BY TxnCount DESC;`,
      viz: "logicalOrder",
      mem: "🧠 Mnemonic: <b>F</b>resh <b>W</b>ater <b>G</b>ives <b>H</b>ealthy <b>S</b>kin, <b>D</b>rink <b>O</b>nly <b>L</b>emon<br>= FROM · WHERE · GROUP BY · HAVING · SELECT · DISTINCT · ORDER BY · LIMIT"
    },
    {
      t: "এই order দিয়ে ৪টা রহস্যের সমাধান",
      bn: "❓ WHERE-এ SELECT alias কেন চলে না? → WHERE (ধাপ ২) চলে, alias জন্মায় ধাপ ৫-এ।<br>❓ ORDER BY-তে alias চলে কেন? → ধাপ ৭, alias ততক্ষণে আছে।<br>❓ WHERE-এ COUNT(*) কেন চলে না? → Aggregate জন্মায় ধাপ ৩-এ। তাই HAVING।<br>❓ LEFT JOIN-এর পর WHERE দিলে INNER JOIN হয়ে যায় কেন? → JOIN আগে NULL row বানায়, পরে WHERE সেগুলো ফেলে দেয়।",
      en: "Alias not in WHERE (born at step 5). Alias OK in ORDER BY (step 7). Aggregates need HAVING. WHERE on the right side of LEFT JOIN kills NULL rows."
    },
    {
      t: "Logical order ≠ Physical order",
      bn: "Logical order = query-র <b>অর্থ</b>। Physical plan = আসলে কীভাবে চলে। Optimizer ফল না বদলিয়ে যেকোনো order-এ চালাতে পারে (যেমন WHERE আগে index seek-এ ঠেলে দেয়)।",
      en: "Logical order defines meaning; the optimizer may physically execute in any equivalent order."
    },
    {
      t: "Client–Server: Round trip-এর খরচ",
      bn: "প্রতিটা statement নেটওয়ার্ক পার হয় → ০.৫–২ ms। ১০০০টা আলাদা INSERT = ১–২ সেকেন্ড শুধু নেটওয়ার্কে! ১টা statement-এ ১০০০ row = ১ round trip।",
      en: "1,000 single INSERTs = 1,000 round trips. One multi-row INSERT = 1 round trip.",
      viz: "roundTrip",
      tip: { bn: "Endpoint slow? আগে মাপো: (১) কয়টা statement যায়, (২) প্রতিটা কয় row ফেরত দেয়, (৩) DB-তে কত সময় লাগে। সমস্যা প্রায় সবসময় round trip-এর সংখ্যা।", en: "Count statements per request first." }
    },
    {
      t: "ACID এক পাতায়",
      bn: "🅰 <b>Atomicity</b> — সব হবে, নয়তো কিছুই না।<br>🅲 <b>Consistency</b> — এক valid অবস্থা থেকে আরেক valid অবস্থায়।<br>🅸 <b>Isolation</b> — একে অপরের অর্ধেক কাজ দেখবে না (এটা tune করা যায়)।<br>🅳 <b>Durability</b> — commit হলে বিদ্যুৎ গেলেও থাকবে।",
      en: "Atomicity, Consistency, Isolation, Durability.",
      viz: "acid",
      iq: { q: "কোন ACID property তুমি নিজে বেছে নিতে পারো?", a: "<b>Isolation</b>। বাকি ৩টা engine গ্যারান্টি দেয়; isolation level প্রতি transaction-এ সেট করা যায়।" }
    }
  ],
  quiz: [
    { q: "WHERE clause-এ SELECT-এর alias ব্যবহার করা যায় না কেন?", o: ["Syntax নিষেধ তাই", "WHERE ধাপ ২-এ চলে, alias জন্মায় ধাপ ৫-এ", "Alias শুধু JOIN-এ চলে", "Optimizer alias বোঝে না"], a: 1, e: "Logical order: FROM→WHERE→GROUP BY→HAVING→SELECT। WHERE-এর সময় alias তৈরিই হয়নি।" },
    { q: "ORDER BY না দিলে row-এর order কেমন?", o: ["Primary key অনুযায়ী", "Insert-এর order অনুযায়ী", "কোনো গ্যারান্টি নেই", "Alphabetical"], a: 2, e: "Table একটা unordered set। Order শুধু plan-এর দুর্ঘটনা।" },
    { q: "কোন ACID property তুমি নিজে tune করতে পারো?", o: ["Atomicity", "Consistency", "Isolation", "Durability"], a: 2, e: "Isolation level প্রতি transaction-এ বদলানো যায়।" },
    { q: "১০০০টা আলাদা single-row INSERT পাঠালে মূল খরচ কোথায়?", o: ["Disk", "CPU", "Network round trip", "Index"], a: 2, e: "প্রতি round trip ~১ ms → ১-২ সেকেন্ড শুধু নেটওয়ার্কে।" }
  ],
  cards: [
    ["Logical order?", "FROM → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → LIMIT"],
    ["Declarative মানে?", "কী চাই বলি, কীভাবে — optimizer ঠিক করে"],
    ["ACID", "Atomicity · Consistency · Isolation · Durability"]
  ]
},
{
  id: 2, part: 1, icon: "🏦",
  en: "The Schema Used in This Book", bn: "BankDB স্কিমা",
  pages: "5–8",
  sections: [
    {
      t: "BankDB — আমাদের ব্যাংক ডাটাবেস",
      bn: "পুরো বই একটা ছোট্ট ব্যাংকিং স্কিমা <b>BankDB</b>-এর উপর চলে। নিচের diagram-এ table-এ ক্লিক করো — কলাম আর সম্পর্ক দেখো।",
      en: "Every example runs on BankDB: Branches, Employees, Customers, Accounts, Transactions, Loans.",
      viz: "schema",
      mem: "১ Customer → অনেক Account → অনেক Transaction। Employee-র Manager-ও একজন Employee (self-reference)।"
    },
    {
      t: "Row count কেন গুরুত্বপূর্ণ",
      bn: "Branches ৪০, Employees ৯০০, Customers ২.৫ লাখ, Accounts ৪ লাখ, <b>Transactions ৬ কোটি</b>, Loans ৩৫ হাজার। ৪ লাখে যে query ঠিক আছে, ৬ কোটিতে সেটা বিপর্যয়।",
      en: "A query fine on 400K Accounts can be catastrophic on 60M Transactions.",
      viz: "rowCounts"
    },
    {
      t: "DDL (CREATE TABLE)",
      bn: "Accounts table — দেখো প্রতিটা লাইন একটা সিদ্ধান্ত: PK, UNIQUE, FK, CHECK।",
      en: "Each clause is a decision.",
      code: `CREATE TABLE dbo.Accounts (
  AccountId     BIGINT        NOT NULL IDENTITY(1,1),
  AccountNumber CHAR(13)      NOT NULL,
  CustomerId    INT           NOT NULL,
  BranchId      INT           NOT NULL,
  AccountType   VARCHAR(10)   NOT NULL,   -- SAVINGS, CURRENT, FD
  Balance       DECIMAL(19,4) NOT NULL DEFAULT 0,
  Currency      CHAR(3)       NOT NULL DEFAULT 'BDT',
  Status        VARCHAR(10)   NOT NULL DEFAULT 'ACTIVE',
  OpenedOn      DATE          NOT NULL,
  ClosedOn      DATE          NULL,
  CONSTRAINT PK_Accounts PRIMARY KEY CLUSTERED (AccountId),
  CONSTRAINT UQ_Accounts_Number UNIQUE (AccountNumber),
  CONSTRAINT FK_Acc_Customer FOREIGN KEY (CustomerId)
             REFERENCES dbo.Customers(CustomerId),
  CONSTRAINT CK_Acc_Type   CHECK (AccountType IN ('SAVINGS','CURRENT','FD')),
  CONSTRAINT CK_Acc_Status CHECK (Status IN ('ACTIVE','DORMANT','CLOSED')),
  CONSTRAINT CK_Acc_Closed CHECK (ClosedOn IS NULL OR ClosedOn >= OpenedOn)
);`,
      run: `SELECT * FROM Accounts;`
    },
    {
      t: "ইঞ্জিনিয়ারের চোখে DDL পড়ো",
      bn: "💰 টাকা = <b>DECIMAL(19,4)</b>, কখনো FLOAT না (0.1+0.2 ≠ 0.3)।<br>⏱ <b>DATETIME2(3)</b>, DATETIME না (৩.৩৩ms rounding)।<br>🔑 Surrogate key (AccountId) দিয়ে JOIN, natural key (AccountNumber) দিয়ে খোঁজো — দুটোতেই constraint।<br>✅ Status কলামে CHECK — app-এ bug হবেই, constraint শেষ পাহারাদার।<br>🔗 FK-র type = PK-র type (mismatch = table scan)।",
      en: "Money = DECIMAL, never FLOAT. DATETIME2 over DATETIME. Surrogate + unique natural key. CHECK constraints are the last line of defence.",
      trap: { bn: "Accounts.Balance হলো derived value (= transaction-এর যোগফল)। এটা রাখা মানে প্রতিটা write-এ transaction-এর ভিতরে update করতেই হবে।", en: "Stored Balance is deliberate denormalization." }
    },
    {
      t: "Sample data (seed)",
      bn: "Multi-row INSERT — একটা statement-এ অনেক row। টাকার পরিমাণ সব <b>Tk</b>-তে।",
      en: "Seed data for running the examples.",
      code: `INSERT INTO dbo.Branches (BranchCode, BranchName, City, OpenedOn)
VALUES ('DHK01', N'Gulshan Corporate', N'Dhaka', '2005-03-01'),
       ('DHK02', N'Motijheel Main',    N'Dhaka', '1998-07-15'),
       ('CTG01', N'Agrabad',           N'Chattogram', '2001-01-10');`,
      run: `SELECT * FROM Branches;`,
      tip: { bn: "PostgreSQL: IDENTITY → GENERATED ALWAYS AS IDENTITY, NVARCHAR → VARCHAR। MySQL: AUTO_INCREMENT; ৮.০.১৬-এর আগে CHECK চুপচাপ ignore হতো!", en: "Dialect notes for Postgres/MySQL." }
    }
  ],
  quiz: [
    { q: "টাকার জন্য কোন type?", o: ["FLOAT", "REAL", "DECIMAL(19,4)", "VARCHAR"], a: 2, e: "FLOAT binary — 0.1 সঠিকভাবে রাখতে পারে না।" },
    { q: "CHECK constraint কেন দরকার যদি app validate করেই?", o: ["দরকার নেই", "App-এ একদিন bug হবে; constraint শেষ পাহারা", "শুধু speed-এর জন্য", "MySQL-এর জন্য"], a: 1, e: "আর optimizer-কেও তথ্য দেয়।" },
    { q: "Employees.ManagerId nullable কেন?", o: ["ভুল করে", "CEO-র কোনো manager নেই", "Performance", "FK এড়াতে"], a: 1, e: "Self-reference; root-এ NULL।" }
  ],
  cards: [
    ["Money type?", "DECIMAL(19,4) — FLOAT কখনো না"],
    ["Timestamp type?", "DATETIME2(3)"],
    ["Surrogate vs natural key", "JOIN surrogate-এ (AccountId), lookup natural-এ (AccountNumber)"]
  ]
},
{
  id: 3, part: 1, icon: "❓",
  en: "Data Types and the Truth About NULL", bn: "Data Type ও NULL-এর সত্য",
  pages: "9–11",
  sections: [
    {
      t: "Type বেছে নেওয়া = Performance সিদ্ধান্ত",
      bn: "Row যত চওড়া, এক page-এ তত কম row → তত বেশি I/O।",
      en: "Type choice is an I/O decision.",
      viz: "typeTable",
      trap: { bn: "'যদি লাগে' ভেবে NVARCHAR(4000) দিও না। Optimizer declared size দেখে memory চায় → অন্য query ক্ষুধার্ত থাকে, tempdb-তে spill হয়।", en: "Declared width drives memory grants. Size honestly." }
    },
    {
      t: "NULL কোনো value না — 'অজানা'",
      bn: "NULL মানে <b>unknown</b>। শূন্য না, খালি string না, এবং <b>NULL = NULL</b> সত্যিও না! তাই <code>= NULL</code> কখনো কাজ করে না → <code>IS NULL</code> লেখো।",
      en: "NULL means unknown. NULL = NULL is UNKNOWN, not TRUE. Use IS NULL.",
      code: `-- কখনো কোনো row আসবে না! NULL = NULL হলো UNKNOWN
SELECT * FROM Customers WHERE Email = NULL;

-- সঠিক:
SELECT * FROM Customers WHERE Email IS NULL;

-- সূক্ষ্ম ফাঁদ: NULL email-ওয়ালারা বাদ পড়ে যায়!
SELECT * FROM Customers WHERE Email <> 'rahim@example.com';

-- তাদেরও চাইলে স্পষ্ট বলো:
SELECT * FROM Customers
WHERE Email <> 'rahim@example.com' OR Email IS NULL;`,
      run: `-- চালাও ও তুলনা করো
SELECT 'Email = NULL' AS q, COUNT(*) FROM Customers WHERE Email = NULL
UNION ALL
SELECT 'Email IS NULL', COUNT(*) FROM Customers WHERE Email IS NULL
UNION ALL
SELECT 'Email <> rahim', COUNT(*) FROM Customers WHERE Email <> 'rahim@example.com'
UNION ALL
SELECT 'Email <> rahim OR NULL', COUNT(*) FROM Customers WHERE Email <> 'rahim@example.com' OR Email IS NULL;`,
      mem: "NULL = 'জানি না'। 'জানি না' কি 'জানি না'-র সমান? → জানি না! 🤷"
    },
    {
      t: "Three-Valued Logic (TRUE / FALSE / UNKNOWN)",
      bn: "WHERE আর JOIN শুধু <b>TRUE</b> রাখে। UNKNOWN = বাদ। নিচে ক্লিক করে AND/OR খেলো।<br>CHECK constraint শুধু FALSE-কে reject করে → তাই <code>CHECK (Salary > 0)</code> NULL salary ঢুকতে দেয়!",
      en: "WHERE keeps only TRUE. CHECK rejects only FALSE — so NULL passes a CHECK.",
      viz: "threeValued"
    },
    {
      t: "Aggregate NULL-কে উপেক্ষা করে",
      bn: "<code>COUNT(*)</code> = row গোনে। <code>COUNT(col)</code> = non-NULL value গোনে। <code>AVG</code> NULL-কে হর থেকেও বাদ দেয়: AVG(100, NULL, 200) = <b>150</b>, ১০০ না।",
      en: "COUNT(*) counts rows; COUNT(col) counts non-NULL values. AVG skips NULLs.",
      code: `SELECT COUNT(*)     FROM Customers;  -- সব row
SELECT COUNT(Email) FROM Customers;  -- শুধু non-NULL Email
SELECT AVG(Balance) FROM Accounts;   -- NULL বাদ দিয়ে গড়`,
      run: `SELECT COUNT(*) AS all_rows, COUNT(Email) AS with_email, COUNT(Phone) AS with_phone FROM Customers;`,
      iq: { q: "COUNT(*), COUNT(1), COUNT(col) — পার্থক্য?", a: "COUNT(*) আর COUNT(1) একদম <b>একই</b> (performance পার্থক্য নেই — এটা মিথ)। COUNT(col) শুধু non-NULL গোনে — ভিন্ন প্রশ্ন।" }
    },
    {
      t: "NULL toolkit: COALESCE, ISNULL, NULLIF",
      bn: "🔹 <b>COALESCE(a,b,c)</b> — প্রথম non-NULL; ANSI standard; অনেক argument।<br>🔹 <b>ISNULL(a,b)</b> — শুধু T-SQL; ঠিক ২টা।<br>🔹 <b>NULLIF(a,b)</b> — a=b হলে NULL; divide-by-zero থেকে বাঁচায়।",
      en: "COALESCE (standard, N args), ISNULL (T-SQL, 2 args), NULLIF (divide-by-zero guard).",
      code: `SELECT COALESCE(c.Email, c.Phone, 'no contact') AS ContactPoint
FROM Customers AS c;

-- ভাগ করার সময় 0 হলে NULL বানিয়ে দাও
SELECT t.Amount / NULLIF(a.Balance, 0) AS Ratio
FROM Transactions AS t
JOIN Accounts AS a ON a.AccountId = t.AccountId;`,
      run: `SELECT FullName, Email, Phone, COALESCE(Email, Phone, 'no contact') AS ContactPoint FROM Customers;`,
      trap: { bn: "ISNULL প্রথম argument-এর type নেয়: ISNULL(CAST(NULL AS CHAR(2)), 'ABCD') → 'AB' (কেটে দেয়!)। COALESCE দেয় 'ABCD'। COALESCE ব্যবহার করো।", en: "ISNULL silently truncates. Prefer COALESCE." }
    },
    {
      t: "Implicit Conversion — নীরব ঘাতক",
      bn: "দুই ভিন্ন type তুলনা করলে engine একদিক convert করে। যদি <b>column</b>-কে convert করে → index অকেজো → SCAN।",
      en: "If the engine converts the column side, the index can't be used.",
      code: `-- AccountNumber হলো CHAR(13)। N'...' হলো NVARCHAR
-- NVARCHAR বড় → COLUMN convert হয় → SCAN 🐢
SELECT * FROM Accounts WHERE AccountNumber = N'1001000000001';

-- column-এর নিজের type দাও → SEEK ⚡
SELECT * FROM Accounts WHERE AccountNumber = '1001000000001';`,
      mem: "Column-কে কখনো রূপ বদলাতে বাধ্য করো না। Literal/parameter-কে column-এর type-এ দাও।"
    }
  ],
  quiz: [
    { q: "SELECT * FROM Customers WHERE Email = NULL কয়টা row দেবে?", o: ["যাদের Email NULL", "সব row", "কোনো row না", "Error"], a: 2, e: "NULL = NULL → UNKNOWN → WHERE বাদ দেয়।" },
    { q: "AVG(100, NULL, 200) = ?", o: ["100", "150", "NULL", "300"], a: 1, e: "NULL হর থেকেও বাদ: 300/2।" },
    { q: "TRUE AND UNKNOWN = ?", o: ["TRUE", "FALSE", "UNKNOWN", "NULL error"], a: 2, e: "FALSE AND যেকোনো = FALSE, কিন্তু TRUE AND UNKNOWN = UNKNOWN।" },
    { q: "TRUE OR UNKNOWN = ?", o: ["TRUE", "FALSE", "UNKNOWN", "Error"], a: 0, e: "OR-এ একটা TRUE থাকলেই TRUE।" },
    { q: "CHECK (Salary > 0) কি NULL salary আটকায়?", o: ["হ্যাঁ", "না — CHECK শুধু FALSE reject করে", "শুধু MySQL-এ", "শুধু INSERT-এ"], a: 1, e: "NULL > 0 = UNKNOWN, FALSE না, তাই পাস।" }
  ],
  cards: [
    ["NULL মানে?", "Unknown (অজানা)। = NULL কাজ করে না; IS NULL লেখো"],
    ["COUNT(*) vs COUNT(col)", "Row গোনে vs non-NULL value গোনে"],
    ["COALESCE vs ISNULL", "COALESCE: standard, N args, truncate করে না"],
    ["NULLIF(x,0)", "Divide-by-zero guard"]
  ]
},
// ───────────────────────────── PART II ─────────────────────────────
{
  id: 4, part: 2, icon: "🔍",
  en: "Querying a Single Table", bn: "একটা Table থেকে Query",
  pages: "13–15",
  sections: [
    {
      t: "SELECT ও Projection",
      bn: "যে কলাম লাগবে শুধু সেগুলো নাও। Expression দিয়ে নতুন কলামও বানানো যায়।",
      en: "Projection: pick the columns you need; compute expressions.",
      code: `SELECT a.AccountNumber,
       a.AccountType,
       a.Balance,
       a.Balance * 0.045 / 12 AS MonthlyInterest,   -- computed
       DATEDIFF(DAY, a.OpenedOn, GETDATE()) AS AgeInDays
FROM dbo.Accounts AS a;`,
      run: `SELECT AccountNumber, AccountType, Balance,
       ROUND(Balance * 0.045 / 12, 2) AS MonthlyInterest,
       CAST(julianday('now') - julianday(OpenedOn) AS INT) AS AgeInDays
FROM Accounts;`,
      trap: { bn: "App code-এ <code>SELECT *</code> = defect। (ক) অদরকারি কলাম আসে (খ) covering index কাজ করে না (গ) কেউ কলাম যোগ করলে DTO ভাঙে (ঘ) JOIN-এ duplicate কলাম নাম।", en: "SELECT * in app code is a defect." }
    },
    {
      t: "WHERE দিয়ে Filter",
      bn: "<code>=</code>, <code>IN</code>, <code>BETWEEN</code>, <code>>=</code>, <code>IS NULL</code> — AND দিয়ে জোড়া।",
      en: "Predicate forms combined with AND.",
      code: `SELECT AccountNumber, Balance
FROM dbo.Accounts
WHERE Status = 'ACTIVE'
  AND AccountType IN ('SAVINGS','CURRENT')
  AND Balance BETWEEN 10000 AND 500000
  AND OpenedOn >= '2020-01-01'
  AND ClosedOn IS NULL;`,
      run: `SELECT AccountNumber, AccountType, Balance
FROM Accounts
WHERE Status = 'ACTIVE'
  AND AccountType IN ('SAVINGS','CURRENT')
  AND Balance BETWEEN 10000 AND 500000
  AND ClosedOn IS NULL;`
    },
    {
      t: "Half-Open Interval নিয়ম ⭐",
      bn: "<code>BETWEEN</code> দুই প্রান্তই inclusive। Date-এ বিপদ: '2026-01-31' মানে রাত ১২:০০ — ৩১ তারিখের বাকি দিন বাদ! নিচের timeline-এ দেখো।",
      en: "For date ranges always use >= start AND < next_start.",
      code: `-- ❌ ভুল: ৩১ জানুয়ারির 00:00:00.001 থেকে 23:59:59.999 বাদ পড়ে
SELECT * FROM Transactions
WHERE TxnDate BETWEEN '2026-01-01' AND '2026-01-31';

-- ✅ সঠিক: [start, end)
SELECT * FROM Transactions
WHERE TxnDate >= '2026-01-01'
  AND TxnDate <  '2026-02-01';`,
      run: `SELECT 'BETWEEN' AS method, COUNT(*) FROM Transactions WHERE TxnDate BETWEEN '2026-01-01' AND '2026-01-31'
UNION ALL
SELECT 'half-open', COUNT(*) FROM Transactions WHERE TxnDate >= '2026-01-01' AND TxnDate < '2026-02-01';`,
      viz: "halfOpen",
      mem: "📅 তারিখ = <b>>= শুরু AND < পরের শুরু</b>। কখনো 23:59:59 hack না।"
    },
    {
      t: "LIKE ও Pattern Matching",
      bn: "শুরু জানা থাকলে (<code>'Rah%'</code>) → index seek ⚡। শুরুতে % (<code>'%uddin'</code>) → পুরো scan 🐢।",
      en: "Leading wildcard forces a full scan.",
      code: `SELECT * FROM Customers WHERE FullName LIKE 'Rah%';     -- ⚡ seekable
SELECT * FROM Customers WHERE FullName LIKE '%uddin';   -- 🐢 scan
SELECT * FROM Accounts  WHERE AccountNumber LIKE '100[12]%'; -- T-SQL char class
SELECT * FROM Transactions WHERE Reference LIKE '%50!%%' ESCAPE '!'; -- literal %`,
      run: `SELECT FullName FROM Customers WHERE FullName LIKE 'Rah%';`
    },
    {
      t: "ORDER BY, TOP ও Pagination",
      bn: "Paging-এ সবসময় একটা <b>unique tiebreaker</b> দাও (AccountId), নইলে একই row দুই page-এ আসবে আর কোনোটা কখনো আসবে না।",
      en: "Always add a unique tiebreaker to ORDER BY used for paging.",
      code: `-- Page 3, প্রতি page-এ 20 row
SELECT AccountNumber, Balance
FROM dbo.Accounts
ORDER BY Balance DESC, AccountId ASC   -- tiebreaker!
OFFSET 40 ROWS FETCH NEXT 20 ROWS ONLY;`,
      run: `-- SQLite/Postgres/MySQL: LIMIT ... OFFSET ...
SELECT AccountNumber, Balance FROM Accounts
ORDER BY Balance DESC, AccountId ASC
LIMIT 3 OFFSET 3;`
    },
    {
      t: "Keyset Pagination — গভীর page-এর জন্য",
      bn: "OFFSET হলো O(n): page ৫০০০ আনতে ৯৯,৯৮০ row পড়ে ফেলে দেয়! Keyset: আগের page-এর শেষ row-এর key পাঠাও → প্রতিটা page page-1-এর মতোই সস্তা। Slider টানো 👇",
      en: "OFFSET cost grows linearly; keyset pagination stays flat.",
      code: `SELECT TOP (20) AccountNumber, Balance, AccountId
FROM dbo.Accounts
WHERE (Balance < @LastBalance)
   OR (Balance = @LastBalance AND AccountId > @LastAccountId)
ORDER BY Balance DESC, AccountId ASC;`,
      viz: "offsetVsKeyset"
    },
    {
      t: "CASE — SQL-এর ভিতরে if/else",
      bn: "CASE একটা expression, তাই যেকোনো জায়গায় চলে — এমনকি aggregate-এর ভিতরেও (Chapter 6-এর জাদু)।",
      en: "CASE is an expression — usable anywhere, even inside aggregates.",
      code: `SELECT a.AccountNumber, a.Balance,
       CASE
         WHEN a.Balance >= 1000000 THEN 'PLATINUM'
         WHEN a.Balance >=  500000 THEN 'GOLD'
         WHEN a.Balance >=  100000 THEN 'SILVER'
         ELSE 'STANDARD'
       END AS Tier
FROM dbo.Accounts AS a
WHERE a.Status = 'ACTIVE';`,
      run: `SELECT AccountNumber, Balance,
  CASE WHEN Balance >= 1000000 THEN 'PLATINUM'
       WHEN Balance >= 500000 THEN 'GOLD'
       WHEN Balance >= 100000 THEN 'SILVER'
       ELSE 'STANDARD' END AS Tier
FROM Accounts WHERE Status = 'ACTIVE';`,
      viz: "caseTier",
      tip: { bn: "Postgres-এ LIKE case-sensitive (ILIKE ব্যবহার করো); SQL Server/MySQL collation অনুযায়ী (সাধারণত insensitive)। Migration-এ আসল bug হয়।", en: "Postgres LIKE is case-sensitive." }
    }
  ],
  quiz: [
    { q: "জানুয়ারি ২০২৬-এর সব transaction-এর সঠিক filter?", o: ["BETWEEN '2026-01-01' AND '2026-01-31'", ">= '2026-01-01' AND < '2026-02-01'", "MONTH(TxnDate)=1", "<= '2026-01-31 23:59:59'"], a: 1, e: "Half-open interval যেকোনো precision-এ সঠিক ও index-friendly।" },
    { q: "কোন LIKE index seek করতে পারে?", o: ["'%uddin'", "'%ah%'", "'Rah%'", "সবগুলো"], a: 2, e: "শুরুর অক্ষর জানা থাকলে seek।" },
    { q: "Page 5000-এর জন্য কোনটা ভালো?", o: ["OFFSET", "Keyset pagination", "SELECT *", "ORDER BY NEWID()"], a: 1, e: "Keyset-এর খরচ page নম্বরের উপর নির্ভর করে না।" },
    { q: "ORDER BY Balance DESC দিয়ে paging-এ সমস্যা?", o: ["কোনো সমস্যা নেই", "সমান balance-এ order অনির্দিষ্ট → row duplicate/হারায়", "Slow", "Syntax error"], a: 1, e: "Unique tiebreaker (AccountId) যোগ করো।" }
  ],
  cards: [
    ["Date range নিয়ম", ">= start AND < next_start (half-open)"],
    ["SELECT * কেন খারাপ?", "অদরকারি data, covering index নষ্ট, DTO ভাঙে"],
    ["Deep paging", "Keyset pagination: শেষ row-এর key পাঠাও"]
  ]
},
{
  id: 5, part: 2, icon: "🔗",
  en: "Joins", bn: "JOIN",
  pages: "16–19",
  sections: [
    {
      t: "JOIN Visualizer 🎮",
      bn: "JOIN type বদলাও আর দেখো কোন row আসে, কোনটা NULL হয়। Customer 'Nusrat'-এর কোনো account নেই — খেয়াল করো।",
      en: "Switch join types and watch which rows survive.",
      viz: "joinViz"
    },
    {
      t: "INNER JOIN — শুধু মিল",
      bn: "শুধু সেই row যেখানে ON শর্ত TRUE। Account নেই এমন customer হারিয়ে যায়।",
      en: "Returns only rows where the predicate is TRUE.",
      code: `SELECT c.FullName, a.AccountNumber, a.Balance
FROM dbo.Customers AS c
INNER JOIN dbo.Accounts AS a ON a.CustomerId = c.CustomerId
WHERE a.Status = 'ACTIVE';`,
      run: `SELECT c.FullName, a.AccountNumber, a.Balance
FROM Customers AS c
INNER JOIN Accounts AS a ON a.CustomerId = c.CustomerId
WHERE a.Status = 'ACTIVE';`,
      trap: { bn: "পুরনো comma syntax (<code>FROM Customers c, Accounts a WHERE ...</code>) কখনো না। WHERE ভুলে গেলে error না দিয়ে চুপচাপ CROSS JOIN: ২.৫ লাখ × ৪ লাখ = ১০,০০০ কোটি row!", en: "Never use comma joins." }
    },
    {
      t: "LEFT JOIN ও WHERE-এর ফাঁদ ⭐",
      bn: "Outer join-এ: <b>ON</b> ঠিক করে কোনটা 'match'; <b>WHERE</b> ঠিক করে কোন result row বাঁচবে। ডান (nullable) table-এর শর্ত <b>ON</b>-এ দাও।",
      en: "On an outer join, a predicate on the nullable table belongs in ON, not WHERE.",
      code: `-- 🐛 BUG: এটা আসলে INNER JOIN হয়ে গেছে!
SELECT c.FullName, a.AccountNumber
FROM dbo.Customers AS c
LEFT JOIN dbo.Accounts AS a ON a.CustomerId = c.CustomerId
WHERE a.Status = 'ACTIVE';     -- NULL = 'ACTIVE' → UNKNOWN → বাদ

-- ✅ সঠিক: শর্ত ON-এ
SELECT c.FullName, a.AccountNumber
FROM dbo.Customers AS c
LEFT JOIN dbo.Accounts AS a
       ON a.CustomerId = c.CustomerId
      AND a.Status = 'ACTIVE';`,
      run: `-- দুটো চালিয়ে row সংখ্যা তুলনা করো
SELECT 'WHERE (bug)' AS version, c.FullName, a.AccountNumber
FROM Customers c LEFT JOIN Accounts a ON a.CustomerId = c.CustomerId
WHERE a.Status = 'ACTIVE'
UNION ALL
SELECT 'ON (correct)', c.FullName, a.AccountNumber
FROM Customers c LEFT JOIN Accounts a ON a.CustomerId = c.CustomerId AND a.Status = 'ACTIVE';`,
      viz: "leftJoinTrap",
      mem: "LEFT JOIN-এ ডান table-এর filter → <b>ON</b>-এ। বাম table-এর filter → WHERE-এ।"
    },
    {
      t: "Anti-Join: যা নেই তা খোঁজো",
      bn: "Account নেই এমন customer খুঁজতে দুই উপায়। <code>NOT EXISTS</code> উদ্দেশ্য বেশি স্পষ্ট।",
      en: "LEFT JOIN … IS NULL, or NOT EXISTS (clearer).",
      code: `-- LEFT JOIN / IS NULL
SELECT c.CustomerId, c.FullName
FROM dbo.Customers AS c
LEFT JOIN dbo.Accounts AS a ON a.CustomerId = c.CustomerId
WHERE a.AccountId IS NULL;   -- ডান table-এর NOT NULL কলাম test করো

-- NOT EXISTS
SELECT c.CustomerId, c.FullName
FROM dbo.Customers AS c
WHERE NOT EXISTS (SELECT 1 FROM dbo.Accounts AS a
                  WHERE a.CustomerId = c.CustomerId);`,
      run: `SELECT c.CustomerId, c.FullName FROM Customers AS c
WHERE NOT EXISTS (SELECT 1 FROM Accounts AS a WHERE a.CustomerId = c.CustomerId);`
    },
    {
      t: "Self Join",
      bn: "একই table নিজের সাথে join — Employee ও তার Manager। কিন্তু মাত্র ১ ধাপ যায়; পুরো chain-এর জন্য recursive CTE (Ch 9)।",
      en: "A self join reaches exactly one level.",
      code: `SELECT e.FullName AS Employee, e.Designation,
       COALESCE(m.FullName, '-- top of tree --') AS Manager
FROM dbo.Employees AS e
LEFT JOIN dbo.Employees AS m ON m.EmployeeId = e.ManagerId;`,
      run: `SELECT e.FullName AS Employee, e.Designation,
       COALESCE(m.FullName, '-- top of tree --') AS Manager
FROM Employees AS e
LEFT JOIN Employees AS m ON m.EmployeeId = e.ManagerId;`
    },
    {
      t: "CROSS JOIN ও CROSS APPLY",
      bn: "CROSS JOIN = সব জোড়া (Cartesian)। কাজে লাগে যেমন (branch × month) বানাতে।<br><b>CROSS APPLY</b> = বাম row প্রতি ডান দিক একবার চলে, বাম row-কে reference করতে পারে → 'প্রতি group-এ top-N'-এর সেরা টুল। <b>OUTER APPLY</b> = APPLY-এর LEFT JOIN।",
      en: "APPLY runs the right side per left row — perfect for top-N per group.",
      code: `-- প্রতিটা ACTIVE account-এর সর্বশেষ ৩টা transaction
SELECT a.AccountNumber, t.TxnDate, t.Amount, t.TxnType
FROM dbo.Accounts AS a
CROSS APPLY (
    SELECT TOP (3) t2.TxnDate, t2.Amount, t2.TxnType
    FROM dbo.Transactions AS t2
    WHERE t2.AccountId = a.AccountId      -- correlation
    ORDER BY t2.TxnDate DESC
) AS t
WHERE a.Status = 'ACTIVE';`,
      tip: { bn: "Index (AccountId, TxnDate DESC) থাকলে প্রতি account-এ ছোট্ট seek, ৩ row পরে থামে — ৬ কোটির বাকিগুলো ছোঁয়ও না।", en: "With the right index APPLY wins by an order of magnitude." }
    },
    {
      t: "Join Fan-out: টাকা দ্বিগুণ হওয়ার Bug 💸",
      bn: "একই parent-এর দুটো স্বাধীন one-to-many child join করলে তারা <b>গুণ</b> হয়। Customer-এর ২ account × ৩ loan = ৬ row → SUM ভুল!",
      en: "Joining two independent one-to-many children multiplies them.",
      code: `-- ❌ ২ + ৩ = ৫ না, ২ × ৩ = ৬ row
SELECT c.FullName, SUM(a.Balance) AS TotalBalance, SUM(l.Principal) AS TotalLoans
FROM dbo.Customers AS c
JOIN dbo.Accounts AS a ON a.CustomerId = c.CustomerId
JOIN dbo.Loans    AS l ON l.CustomerId = c.CustomerId
GROUP BY c.FullName;

-- ✅ আগে aggregate, পরে join
SELECT c.FullName, acc.TotalBalance, lo.TotalLoans
FROM dbo.Customers AS c
OUTER APPLY (SELECT SUM(a.Balance) AS TotalBalance
             FROM dbo.Accounts a WHERE a.CustomerId = c.CustomerId) AS acc
OUTER APPLY (SELECT SUM(l.Principal) AS TotalLoans
             FROM dbo.Loans l WHERE l.CustomerId = c.CustomerId) AS lo;`,
      run: `-- ভুল vs সঠিক (SQLite-এ subquery দিয়ে)
SELECT 'WRONG' AS v, c.FullName, SUM(a.Balance) AS TotalBalance, SUM(l.Principal) AS TotalLoans
FROM Customers c JOIN Accounts a ON a.CustomerId=c.CustomerId JOIN Loans l ON l.CustomerId=c.CustomerId
GROUP BY c.FullName
UNION ALL
SELECT 'RIGHT', c.FullName,
  (SELECT SUM(Balance) FROM Accounts a WHERE a.CustomerId=c.CustomerId),
  (SELECT SUM(Principal) FROM Loans l WHERE l.CustomerId=c.CustomerId)
FROM Customers c WHERE c.CustomerId IN (SELECT CustomerId FROM Loans);`,
      viz: "fanout",
      iq: { q: "Report-এ revenue ঠিক দ্বিগুণ দেখাচ্ছে। প্রথমে কোথায় দেখবে?", a: "<b>Join fan-out</b>। কোনো join one-to-many, অথচ লেখক one-to-one ধরেছে। Aggregate সরিয়ে key প্রতি row গুনে test করো।" }
    },
    {
      t: "Physical Join Algorithm",
      bn: "Optimizer ৩টার একটা বেছে নেয় — তুমি plan-এ চিনতে পারলেই হবে।",
      en: "Nested Loops, Merge Join, Hash Match.",
      viz: "joinAlgos",
      tip: { bn: "যেখানে seek আশা করেছিলে সেখানে Hash Match = সম্ভবত missing index বা type mismatch। লক্ষ লক্ষ outer row-এ Nested Loops = 'estimated 1, actual 4 million' সমস্যা।", en: "Unexpected Hash Match → missing index or type mismatch." }
    }
  ],
  quiz: [
    { q: "LEFT JOIN-এর পর WHERE a.Status='ACTIVE' দিলে কী হয়?", o: ["কিছুই না", "কার্যত INNER JOIN হয়ে যায়", "Error", "Duplicate row আসে"], a: 1, e: "NULL-padded row গুলো WHERE ফেলে দেয়।" },
    { q: "২ account ও ৩ loan-ওয়ালা customer-কে দুটোর সাথে JOIN করলে কয় row?", o: ["5", "6", "3", "2"], a: 1, e: "Fan-out: 2 × 3।" },
    { q: "Account নেই এমন customer খোঁজার পরিষ্কার উপায়?", o: ["INNER JOIN", "NOT EXISTS", "CROSS JOIN", "UNION"], a: 1, e: "Anti-join; NOT EXISTS উদ্দেশ্য স্পষ্ট করে।" },
    { q: "'প্রতি account-এর সর্বশেষ ৩ transaction' — কোন টুল?", o: ["CROSS APPLY + TOP 3", "UNION", "HAVING", "DISTINCT"], a: 0, e: "APPLY বাম row প্রতি একবার চলে।" },
    { q: "Inner input ছোট আর ভিতরে index আছে → কোন algorithm?", o: ["Hash Match", "Merge Join", "Nested Loops", "Sort"], a: 2, e: "প্রতি outer row-এ seek।" }
  ],
  cards: [
    ["ON vs WHERE (outer join)", "ON = কী match; WHERE = কোন row বাঁচবে"],
    ["Fan-out fix", "আগে aggregate, পরে join"],
    ["CROSS vs OUTER APPLY", "CROSS খালি ফল বাদ দেয়; OUTER রাখে (NULL সহ)"],
    ["৩ physical join", "Nested Loops · Merge · Hash Match"]
  ]
},
{
  id: 6, part: 2, icon: "📊",
  en: "Aggregation and Grouping", bn: "Aggregation ও Grouping",
  pages: "20–22",
  sections: [
    {
      t: "Aggregate Functions",
      bn: "COUNT, SUM, AVG, MIN, MAX, COUNT(DISTINCT) — অনেক row থেকে এক value।",
      en: "Aggregates collapse many rows into one value.",
      code: `SELECT COUNT(*)                  AS TxnCount,
       SUM(Amount)               AS TotalAmount,
       AVG(Amount)               AS AvgAmount,
       MIN(TxnDate)              AS FirstTxn,
       MAX(TxnDate)              AS LastTxn,
       COUNT(DISTINCT AccountId) AS DistinctAccounts
FROM dbo.Transactions
WHERE TxnDate >= '2026-01-01' AND TxnDate < '2026-02-01';`,
      run: `SELECT COUNT(*) AS TxnCount, SUM(Amount) AS TotalAmount, ROUND(AVG(Amount),2) AS AvgAmount,
       MIN(TxnDate) AS FirstTxn, MAX(TxnDate) AS LastTxn, COUNT(DISTINCT AccountId) AS DistinctAccounts
FROM Transactions WHERE TxnDate >= '2026-01-01' AND TxnDate < '2026-02-01';`
    },
    {
      t: "GROUP BY — 'প্রতি-কলাম' নিয়ম",
      bn: "SELECT-এর প্রতিটা non-aggregate কলাম GROUP BY-তে থাকতেই হবে। কারণ ধাপ ৩-এর পর আর আলাদা row নেই — শুধু group। নিচে ▶ চাপো: row গুলো group-এ জমে।",
      en: "Every non-aggregated SELECT column must be in GROUP BY — after grouping, only groups exist.",
      code: `SELECT b.BranchName, a.AccountType,
       COUNT(*)       AS AccountCount,
       SUM(a.Balance) AS TotalBalance
FROM dbo.Accounts AS a
JOIN dbo.Branches AS b ON b.BranchId = a.BranchId
WHERE a.Status = 'ACTIVE'
GROUP BY b.BranchName, a.AccountType
ORDER BY b.BranchName, a.AccountType;`,
      run: `SELECT b.BranchName, a.AccountType, COUNT(*) AS AccountCount, SUM(a.Balance) AS TotalBalance
FROM Accounts AS a JOIN Branches AS b ON b.BranchId = a.BranchId
WHERE a.Status = 'ACTIVE'
GROUP BY b.BranchName, a.AccountType
ORDER BY b.BranchName, a.AccountType;`,
      viz: "groupBy"
    },
    {
      t: "WHERE vs HAVING",
      bn: "<b>WHERE</b> = group করার <b>আগে</b> row ছাঁটে (ধাপ ২)। <b>HAVING</b> = group করার <b>পরে</b> পুরো group ছাঁটে (ধাপ ৪)। Aggregate ছাড়া যেকোনো শর্ত → WHERE-এ, সবসময়।",
      en: "WHERE filters rows before grouping; HAVING filters groups after.",
      code: `SELECT a.CustomerId, COUNT(*) AS ActiveAccounts, SUM(a.Balance) AS Total
FROM dbo.Accounts AS a
WHERE a.Status = 'ACTIVE'      -- ধাপ ২: row বাদ
GROUP BY a.CustomerId
HAVING COUNT(*) >= 2           -- ধাপ ৪: group বাদ
   AND SUM(a.Balance) > 500000;`,
      run: `SELECT a.CustomerId, COUNT(*) AS ActiveAccounts, SUM(a.Balance) AS Total
FROM Accounts AS a
WHERE a.Status = 'ACTIVE'
GROUP BY a.CustomerId
HAVING COUNT(*) >= 2;`,
      mem: "🧹 WHERE = বাজারে ঢোকার আগে বাছাই। 🧺 HAVING = ব্যাগ ভরার পর পুরো ব্যাগ বাদ। যত আগে ছাঁটবে তত কম কাজ।"
    },
    {
      t: "Conditional Aggregation ⭐ (এক scan, ছয় উত্তর)",
      bn: "Aggregate-এর ভিতরে CASE → একবার table পড়ে অনেক উত্তর। ৬টা আলাদা query UNION করলে ৬ কোটি row-এর table ৬ বার পড়তে হতো!",
      en: "CASE inside aggregates computes many answers in a single pass.",
      code: `SELECT a.BranchId,
  COUNT(*) AS TotalTxns,
  SUM(CASE WHEN t.TxnType = 'CREDIT' THEN t.Amount ELSE 0 END) AS Credits,
  SUM(CASE WHEN t.TxnType = 'DEBIT'  THEN t.Amount ELSE 0 END) AS Debits,
  SUM(CASE WHEN t.Channel = 'ATM'    THEN 1 ELSE 0 END)        AS AtmCount,
  COUNT(CASE WHEN t.Channel = 'ONLINE' THEN 1 END)             AS OnlineCount,
  AVG(CASE WHEN t.TxnType = 'DEBIT'  THEN t.Amount END)        AS AvgDebit
FROM dbo.Transactions AS t
JOIN dbo.Accounts AS a ON a.AccountId = t.AccountId
WHERE t.TxnDate >= '2026-01-01'
GROUP BY a.BranchId;`,
      run: `SELECT a.BranchId,
  COUNT(*) AS TotalTxns,
  SUM(CASE WHEN t.TxnType = 'CREDIT' THEN t.Amount ELSE 0 END) AS Credits,
  SUM(CASE WHEN t.TxnType = 'DEBIT'  THEN t.Amount ELSE 0 END) AS Debits,
  SUM(CASE WHEN t.Channel = 'ATM' THEN 1 ELSE 0 END) AS AtmCount,
  COUNT(CASE WHEN t.Channel = 'ONLINE' THEN 1 END) AS OnlineCount,
  ROUND(AVG(CASE WHEN t.TxnType = 'DEBIT' THEN t.Amount END),2) AS AvgDebit
FROM Transactions AS t JOIN Accounts AS a ON a.AccountId = t.AccountId
WHERE t.TxnDate >= '2026-01-01'
GROUP BY a.BranchId;`,
      tip: { bn: "AVG(CASE WHEN ... THEN x END)-এ ELSE নেই ইচ্ছা করে — NULL বাদ যায়, তাই শুধু match করা row-এর গড়। ELSE 0 দিলে গড় ভুল হবে।", en: "Omit ELSE in AVG so non-matches become NULL and are skipped." }
    },
    {
      t: "GROUPING SETS, ROLLUP, CUBE",
      bn: "Subtotal + grand total একটা pass-এ, UNION ALL ছাড়া। <code>GROUPING(col)</code> = 1 মানে এই row subtotal (NULL আসল data না)।",
      en: "Subtotals and grand totals in one pass.",
      code: `-- (branch,type), branch subtotal, grand total — এক pass-এ
SELECT b.BranchName, a.AccountType,
       SUM(a.Balance) AS TotalBalance,
       GROUPING(a.AccountType) AS IsTypeSubtotal
FROM dbo.Accounts AS a
JOIN dbo.Branches AS b ON b.BranchId = a.BranchId
GROUP BY ROLLUP (b.BranchName, a.AccountType);

-- ঠিক যে combination চাও
GROUP BY GROUPING SETS ( (b.City, a.AccountType), (b.City), () );`,
      viz: "rollup",
      iq: { q: "প্রতি branch-এর total আর grand total — এক result-এ?", a: "<code>GROUP BY ROLLUP(BranchName)</code>। দুর্বল উত্তর: দুটো query UNION ALL (দুইবার scan)।" }
    }
  ],
  quiz: [
    { q: "Aggregate ছাড়া শর্ত কোথায় দেবে?", o: ["HAVING", "WHERE", "ORDER BY", "যেকোনো"], a: 1, e: "WHERE আগে row কমায় → group-এর কাজ কম।" },
    { q: "একই query-তে Credits ও Debits আলাদা total — সেরা উপায়?", o: ["দুই query UNION", "SUM(CASE WHEN ...)", "দুটো temp table", "Cursor"], a: 1, e: "Conditional aggregation — এক scan।" },
    { q: "GROUPING(col) = 1 মানে?", o: ["কলাম NULL data", "Row-টা rollup subtotal", "Error", "Duplicate"], a: 1, e: "Subtotal NULL আর আসল NULL আলাদা করার একমাত্র উপায়।" },
    { q: "SELECT b.BranchName, a.OpenedOn, COUNT(*) ... GROUP BY b.BranchName — কী হবে?", o: ["চলবে", "Error: OpenedOn GROUP BY-তে নেই", "OpenedOn NULL হবে", "প্রথম value দেবে"], a: 1, e: "একটা group-এ অনেক OpenedOn — কোনটা?" }
  ],
  cards: [
    ["WHERE vs HAVING", "WHERE row ছাঁটে (আগে) · HAVING group ছাঁটে (পরে)"],
    ["Conditional aggregation", "SUM(CASE WHEN x THEN amt ELSE 0 END)"],
    ["Grand total", "GROUP BY ROLLUP(...)"]
  ]
},
{
  id: 7, part: 2, icon: "⭕",
  en: "Set Operators", bn: "Set Operator",
  pages: "23–24",
  sections: [
    {
      t: "চারটা Operator 🎮",
      bn: "নিচে operator বদলাও — Venn diagram আর ফলাফল দেখো। A = যাদের Account আছে, B = যাদের Loan আছে।",
      en: "UNION ALL, UNION, INTERSECT, EXCEPT.",
      viz: "setOps",
      code: `-- দুই উৎস থেকে সবাই
SELECT FullName, 'CUSTOMER' AS PartyType FROM dbo.Customers
UNION ALL
SELECT FullName, 'EMPLOYEE' FROM dbo.Employees;

-- Account আর Loan দুটোই আছে
SELECT CustomerId FROM dbo.Accounts
INTERSECT
SELECT CustomerId FROM dbo.Loans;

-- Account আছে কিন্তু Loan নেই
SELECT CustomerId FROM dbo.Accounts
EXCEPT
SELECT CustomerId FROM dbo.Loans;`,
      run: `SELECT CustomerId FROM Accounts
INTERSECT
SELECT CustomerId FROM Loans;`
    },
    {
      t: "UNION vs UNION ALL",
      bn: "<b>UNION ALL</b> = শুধু জোড়া লাগানো (সস্তা)। <b>UNION</b> = duplicate মুছতে sort/hash (দামি)। Input আগে থেকেই আলাদা জানলে UNION ALL — ফ্রি performance!",
      en: "Default to UNION ALL; use UNION only when you need dedup.",
      mem: "ALL = 'সব রাখো, বাছাই করো না' → দ্রুত। ১০টার ৯টা UNION আসলে UNION ALL হওয়া উচিত।"
    },
    {
      t: "নিয়ম ও NULL আচরণ",
      bn: "• প্রতিটা input-এ সমান সংখ্যক কলাম, compatible type।<br>• কলামের নাম আসে প্রথম query থেকে।<br>• ORDER BY শুধু একটা, একদম শেষে।<br>• Set operator <b>NULL-কে সমান ধরে</b> (= এর মতো না)!",
      en: "Same column count; names from first query; one ORDER BY at the end; NULLs compare equal.",
      tip: { bn: "দুটো query-র ফল একই কিনা যাচাই: <code>(A EXCEPT B) UNION ALL (B EXCEPT A)</code> → ০ row হলে হুবহু এক (NULL সহ)। Refactor-এর পর এটা চালাও।", en: "EXCEPT both ways = table diff." },
      code: `-- দুই query-র ফল একই? ০ row = একই ✅
(SELECT * FROM QueryA EXCEPT SELECT * FROM QueryB)
UNION ALL
(SELECT * FROM QueryB EXCEPT SELECT * FROM QueryA);`
    }
  ],
  quiz: [
    { q: "কোনটা সবচেয়ে সস্তা?", o: ["UNION", "UNION ALL", "INTERSECT", "EXCEPT"], a: 1, e: "শুধু concatenation, কোনো dedup নেই।" },
    { q: "Account আছে কিন্তু Loan নেই — কোন operator?", o: ["INTERSECT", "UNION", "EXCEPT", "UNION ALL"], a: 2, e: "A EXCEPT B।" },
    { q: "Set operator-এ NULL = NULL?", o: ["সমান ধরে", "আলাদা ধরে", "Error", "বাদ দেয়"], a: 0, e: "তাই EXCEPT দিয়ে table diff করা যায়।" }
  ],
  cards: [
    ["UNION vs UNION ALL", "UNION dedup করে (দামি); ALL করে না (সস্তা)"],
    ["Table diff", "(A EXCEPT B) UNION ALL (B EXCEPT A)"]
  ]
},
// ───────────────────────────── PART III ─────────────────────────────
{
  id: 8, part: 3, icon: "🪆",
  en: "Subqueries", bn: "Subquery",
  pages: "26–27",
  sections: [
    {
      t: "তিন ধরনের Subquery",
      bn: "🔸 <b>Scalar</b> — ঠিক ১টা value দেয় (২+ row দিলে runtime error)।<br>🔸 <b>Multi-valued</b> — IN-কে list দেয়।<br>🔸 <b>Correlated</b> — বাইরের query-কে reference করে, ধারণাগতভাবে প্রতি row-এ চলে।",
      en: "Scalar, multi-valued, correlated.",
      code: `-- Scalar
SELECT AccountNumber, Balance,
       Balance - (SELECT AVG(Balance) FROM dbo.Accounts) AS VsAverage
FROM dbo.Accounts;

-- Multi-valued
SELECT FullName FROM dbo.Customers
WHERE CustomerId IN (SELECT CustomerId FROM dbo.Loans WHERE Status = 'DEFAULTED');

-- Correlated
SELECT c.FullName,
       (SELECT COUNT(*) FROM dbo.Accounts AS a
        WHERE a.CustomerId = c.CustomerId) AS AccountCount
FROM dbo.Customers AS c;`,
      run: `SELECT c.FullName,
       (SELECT COUNT(*) FROM Accounts AS a WHERE a.CustomerId = c.CustomerId) AS AccountCount
FROM Customers AS c;`,
      tip: { bn: "'প্রতি row-এ চলে' — এটা অর্থ, execution-এর প্রতিশ্রুতি না। Optimizer প্রায়ই এটাকে hash join বানিয়ে একবার চালায়। না মেপে কুৎসিত join-এ rewrite কোরো না।", en: "Optimizer often decorrelates. Measure before rewriting." }
    },
    {
      t: "EXISTS vs IN vs JOIN",
      bn: "EXISTS = হ্যাঁ/না প্রশ্ন, প্রথম match-এ থামে, row সংখ্যা <b>কখনো বাড়ায় না</b>। JOIN = প্রতি account-এ customer একবার করে → duplicate!",
      en: "EXISTS never changes multiplicity; JOIN fans out.",
      code: `-- EXISTS: প্রতি customer একবার
SELECT c.FullName FROM dbo.Customers AS c
WHERE EXISTS (SELECT 1 FROM dbo.Accounts AS a WHERE a.CustomerId = c.CustomerId);

-- JOIN: ভিন্ন! account প্রতি একবার → duplicate
SELECT c.FullName FROM dbo.Customers AS c
JOIN dbo.Accounts AS a ON a.CustomerId = c.CustomerId;`,
      run: `SELECT 'EXISTS' AS how, COUNT(*) FROM Customers c WHERE EXISTS (SELECT 1 FROM Accounts a WHERE a.CustomerId=c.CustomerId)
UNION ALL
SELECT 'JOIN', COUNT(*) FROM Customers c JOIN Accounts a ON a.CustomerId=c.CustomerId;`,
      mem: "JOIN-এর পর <code>SELECT DISTINCT</code> লিখছ? → সম্ভবত তুমি EXISTS চেয়েছিলে।"
    },
    {
      t: "NOT IN-এর NULL ফাঁদ 💣",
      bn: "Subquery-তে একটাও NULL থাকলে NOT IN <b>শূন্য row</b> দেয় — সবসময়! নিচে NULL যোগ করে দেখো।",
      en: "If the subquery returns any NULL, NOT IN returns zero rows.",
      code: `-- x NOT IN (1, 2, NULL) মানে:
--   x <> 1 AND x <> 2 AND x <> NULL
-- → TRUE AND TRUE AND UNKNOWN → UNKNOWN → row বাদ!

-- নিরাপদ:
SELECT b.BranchName FROM dbo.Branches AS b
WHERE NOT EXISTS (SELECT 1 FROM dbo.Employees AS e
                  WHERE e.BranchId = b.BranchId);`,
      run: `SELECT 'NOT IN (1,2)' AS q, COUNT(*) FROM Branches WHERE BranchId NOT IN (1,2)
UNION ALL
SELECT 'NOT IN (1,2,NULL)', COUNT(*) FROM Branches WHERE BranchId NOT IN (1,2,NULL);`,
      viz: "notInTrap",
      iq: { q: "NOT IN আর NOT EXISTS কখন আলাদা?", a: "যখন subquery NULL দিতে পারে। NOT IN তখন কিছুই দেয় না; NOT EXISTS ঠিক থাকে। <b>Default: NOT EXISTS</b>।" }
    },
    {
      t: "Derived Table (FROM-এ subquery)",
      bn: "FROM-এর ভিতরে subquery। Alias বাধ্যতামূলক, দুইবার reference করা যায় না, nesting কুৎসিত হয় → CTE এর সমাধান।",
      en: "Derived tables must be aliased and nest badly — CTEs fix that.",
      code: `SELECT d.BranchId, d.TxnCount
FROM (
    SELECT a.BranchId, COUNT(*) AS TxnCount
    FROM dbo.Transactions AS t
    JOIN dbo.Accounts AS a ON a.AccountId = t.AccountId
    WHERE t.TxnDate >= '2026-01-01'
    GROUP BY a.BranchId
) AS d
WHERE d.TxnCount > 100000;`,
      run: `SELECT d.BranchId, d.TxnCount FROM (
  SELECT a.BranchId, COUNT(*) AS TxnCount
  FROM Transactions t JOIN Accounts a ON a.AccountId = t.AccountId
  GROUP BY a.BranchId) AS d
WHERE d.TxnCount > 3;`
    }
  ],
  quiz: [
    { q: "WHERE x NOT IN (1, 2, NULL) কয় row দেবে?", o: ["x≠1,2 সব", "শূন্য", "শুধু NULL", "Error"], a: 1, e: "x <> NULL = UNKNOWN → AND-এ সব UNKNOWN।" },
    { q: "কোনটা row multiplicity বদলায় না?", o: ["JOIN", "EXISTS", "CROSS JOIN", "UNION ALL"], a: 1, e: "EXISTS শুধু হ্যাঁ/না।" },
    { q: "Scalar subquery ২ row দিলে?", o: ["প্রথমটা নেয়", "Runtime error", "NULL", "দুটো row"], a: 1, e: "Scalar ঠিক একটা value।" }
  ],
  cards: [
    ["NOT IN trap", "Subquery-তে NULL → ০ row। NOT EXISTS ব্যবহার করো"],
    ["JOIN + DISTINCT?", "সম্ভবত EXISTS চেয়েছিলে"]
  ]
}
];
