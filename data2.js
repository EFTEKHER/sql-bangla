CHAPTERS.push(
{
  id: 9, part: 3, icon: "🌳",
  en: "Common Table Expressions", bn: "CTE (WITH)",
  pages: "28–30",
  sections: [
    {
      t: "CTE কেন?",
      bn: "CTE = এক statement-এর জন্য একটা নামওয়ালা temporary result। Nested query-কে ধাপে ধাপে পড়ার মতো বানায়। একটা CTE আগের CTE-কে ব্যবহার করতে পারে।",
      en: "A named result set for one statement — readability, reuse, recursion.",
      code: `WITH MonthlyTxn AS (
    SELECT a.BranchId,
           DATEFROMPARTS(YEAR(t.TxnDate), MONTH(t.TxnDate), 1) AS TxnMonth,
           SUM(t.Amount) AS Total
    FROM dbo.Transactions AS t
    JOIN dbo.Accounts AS a ON a.AccountId = t.AccountId
    WHERE t.TxnDate >= '2025-01-01'
    GROUP BY a.BranchId, DATEFROMPARTS(YEAR(t.TxnDate), MONTH(t.TxnDate), 1)
),
BranchAverage AS (
    SELECT BranchId, AVG(Total) AS AvgMonthly
    FROM MonthlyTxn                 -- আগের CTE ব্যবহার
    GROUP BY BranchId
)
SELECT m.BranchId, m.TxnMonth, m.Total, b.AvgMonthly,
       m.Total - b.AvgMonthly AS Variance
FROM MonthlyTxn AS m
JOIN BranchAverage AS b ON b.BranchId = m.BranchId
WHERE m.Total > b.AvgMonthly * 1.5;`,
      run: `WITH MonthlyTxn AS (
  SELECT a.BranchId, substr(t.TxnDate,1,7) AS TxnMonth, SUM(t.Amount) AS Total
  FROM Transactions t JOIN Accounts a ON a.AccountId = t.AccountId
  GROUP BY a.BranchId, substr(t.TxnDate,1,7)
),
BranchAverage AS (
  SELECT BranchId, AVG(Total) AS AvgMonthly FROM MonthlyTxn GROUP BY BranchId
)
SELECT m.BranchId, m.TxnMonth, m.Total, ROUND(b.AvgMonthly,2) AS AvgMonthly
FROM MonthlyTxn m JOIN BranchAverage b ON b.BranchId = m.BranchId
ORDER BY m.BranchId, m.TxnMonth;`,
      trap: { bn: "CTE temp table <b>না</b>! এটা macro-র মতো query-তে বসে যায়। দুইবার reference করলে দুইবার চলতে পারে। দামি ও বারবার লাগলে → #temp table।", en: "CTEs are inlined, not materialised. CTEs for clarity; #temp for reuse." }
    },
    {
      t: "Recursive CTE — Tree হাঁটা 🌳",
      bn: "৩টা অংশ: ① <b>Anchor</b> (শুরুর row, একবার চলে) ② <b>UNION ALL</b> ③ <b>Recursive member</b> (CTE-কে নিজেই join করে, ০ row না আসা পর্যন্ত চলে)। নিচে ধাপে ধাপে দেখো।",
      en: "Anchor + UNION ALL + recursive member. Stops when an iteration returns 0 rows.",
      code: `WITH OrgChart AS (
    -- ① ANCHOR: CEO (ManagerId NULL)
    SELECT e.EmployeeId, e.FullName, e.ManagerId, e.Designation,
           0 AS Depth,
           CAST(e.FullName AS NVARCHAR(4000)) AS Path
    FROM dbo.Employees AS e
    WHERE e.ManagerId IS NULL

    UNION ALL      -- ② সবসময় UNION ALL

    -- ③ RECURSIVE: আগের level-এর অধীনস্থরা
    SELECT e.EmployeeId, e.FullName, e.ManagerId, e.Designation,
           o.Depth + 1,
           CAST(o.Path + N' > ' + e.FullName AS NVARCHAR(4000))
    FROM dbo.Employees AS e
    JOIN OrgChart AS o ON o.EmployeeId = e.ManagerId
)
SELECT REPLICATE('  ', Depth) + FullName AS Hierarchy, Designation, Depth, Path
FROM OrgChart
ORDER BY Path
OPTION (MAXRECURSION 100);   -- guard rail`,
      run: `WITH RECURSIVE OrgChart AS (
  SELECT EmployeeId, FullName, ManagerId, Designation, 0 AS Depth, FullName AS Path
  FROM Employees WHERE ManagerId IS NULL
  UNION ALL
  SELECT e.EmployeeId, e.FullName, e.ManagerId, e.Designation, o.Depth + 1, o.Path || ' > ' || e.FullName
  FROM Employees e JOIN OrgChart o ON o.EmployeeId = e.ManagerId
)
SELECT substr('                ', 1, Depth*3) || FullName AS Hierarchy, Designation, Depth, Path
FROM OrgChart ORDER BY Path;`,
      viz: "recursiveTree",
      mem: "Anchor 🌱 + UNION ALL ➕ + নিজেকে JOIN 🔁 = Recursion। MAXRECURSION 0 = অসীম = data-তে cycle থাকলে outage!"
    },
    {
      t: "Series তৈরি — খালি মাসও দেখাও",
      bn: "GROUP BY শুধু যে data আছে তার row দেয়। Transaction নেই এমন মাস report থেকে হারিয়ে যায়। সমাধান: আগে calendar বানাও, তারপর LEFT JOIN।",
      en: "Generate the calendar, then LEFT JOIN facts onto it.",
      code: `WITH Months AS (
    SELECT CAST('2026-01-01' AS DATE) AS MonthStart
    UNION ALL
    SELECT DATEADD(MONTH, 1, MonthStart) FROM Months
    WHERE MonthStart < '2026-12-01'
)
SELECT m.MonthStart,
       COALESCE(SUM(t.Amount), 0) AS Total     -- 0, হারানো row না
FROM Months AS m
LEFT JOIN dbo.Transactions AS t
       ON t.TxnDate >= m.MonthStart
      AND t.TxnDate <  DATEADD(MONTH, 1, m.MonthStart)
GROUP BY m.MonthStart
ORDER BY m.MonthStart;`,
      run: `WITH RECURSIVE Months AS (
  SELECT date('2026-01-01') AS MonthStart
  UNION ALL
  SELECT date(MonthStart, '+1 month') FROM Months WHERE MonthStart < '2026-06-01'
)
SELECT m.MonthStart, COALESCE(SUM(t.Amount), 0) AS Total
FROM Months m
LEFT JOIN Transactions t ON t.TxnDate >= m.MonthStart AND t.TxnDate < date(m.MonthStart, '+1 month')
GROUP BY m.MonthStart ORDER BY m.MonthStart;`,
      trap: { bn: "Recursive CTE একটা একটা করে row বানায় — declarative পোশাকে loop। মাস/org level-এর জন্য দারুণ; ১০ লাখ সংখ্যার জন্য slow → numbers table ব্যবহার করো।", en: "Recursive CTEs are slow for large series." }
    },
    {
      t: "Updatable CTE — Duplicate মোছা",
      bn: "CTE + ROW_NUMBER দিয়ে duplicate খুঁজে <b>base table থেকে</b> DELETE — সবচেয়ে পুরনোটা রেখে।",
      en: "Classic dedup: CTE + ROW_NUMBER, delete rn > 1.",
      code: `WITH Ranked AS (
    SELECT c.CustomerId,
           ROW_NUMBER() OVER (PARTITION BY c.NationalId
                              ORDER BY c.CreatedAt ASC) AS rn
    FROM dbo.Customers AS c
)
DELETE FROM Ranked WHERE rn > 1;   -- পুরনোটা থাকে`,
      tip: { bn: "PostgreSQL/MySQL-এ <code>WITH RECURSIVE</code> লিখতেই হবে। Postgres v12-এর আগে CTE সবসময় materialise হতো।", en: "Postgres/MySQL require WITH RECURSIVE." }
    }
  ],
  quiz: [
    { q: "Recursive CTE-তে anchor আর recursive member-এর মাঝে কী?", o: ["UNION", "UNION ALL", "JOIN", "INTERSECT"], a: 1, e: "সবসময় UNION ALL।" },
    { q: "Recursion কখন থামে?", o: ["১০ বার পরে", "যখন এক iteration ০ row দেয়", "MAXRECURSION 0 হলে", "কখনো না"], a: 1, e: "MAXRECURSION গার্ড রেল।" },
    { q: "CTE কি materialise হয় (SQL Server)?", o: ["হ্যাঁ, temp table-এর মতো", "না, inline হয়", "শুধু recursive হলে", "শুধু index থাকলে"], a: 1, e: "দামি ও reuse হলে #temp ব্যবহার করো।" }
  ],
  cards: [
    ["Recursive CTE-র ৩ অংশ", "Anchor + UNION ALL + recursive member"],
    ["CTE vs #temp", "CTE = clarity, #temp = reuse + statistics"],
    ["খালি মাস দেখাতে", "Calendar CTE + LEFT JOIN + COALESCE"]
  ]
},
{
  id: 10, part: 3, icon: "🪟",
  en: "Window Functions", bn: "Window Function",
  pages: "31–33",
  sections: [
    {
      t: "OVER()-এর গঠন ⭐",
      bn: "Window function row-গুলোকে <b>না গুটিয়ে</b> হিসাব করে — GROUP BY যা পারে না। ৩টা অংশ:<br>① <b>PARTITION BY</b> — GROUP BY-র মতো, কিন্তু row থাকে।<br>② <b>ORDER BY</b> — window-এর ভিতরে order।<br>③ <b>Frame</b> — current row-এর সাপেক্ষে কোন row গুলো গোনা হবে।",
      en: "Window functions compute across rows without collapsing them.",
      code: `SELECT t.AccountId, t.TxnDate, t.Amount,
       SUM(t.Amount) OVER (
           PARTITION BY t.AccountId          -- ① প্রতি account-এ reset
           ORDER BY t.TxnDate                -- ② ভিতরের order
           ROWS BETWEEN UNBOUNDED PRECEDING  -- ③ frame
                AND CURRENT ROW
       ) AS RunningTotal
FROM dbo.Transactions AS t;`,
      run: `SELECT AccountId, TxnDate, Amount,
  SUM(Amount) OVER (PARTITION BY AccountId ORDER BY TxnDate
                    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS RunningTotal
FROM Transactions WHERE AccountId IN (1,2) ORDER BY AccountId, TxnDate;`,
      viz: "windowViz",
      mem: "GROUP BY = সব গুটিয়ে এক লাইন 📦। Window = সব row থাকে, পাশে হিসাব 🪟।"
    },
    {
      t: "Ranking: ROW_NUMBER vs RANK vs DENSE_RANK 🏆",
      bn: "Balance বদলে tie তৈরি করো আর দেখো তিনটা কীভাবে আলাদা আচরণ করে।",
      en: "ROW_NUMBER unique; RANK ties + gaps; DENSE_RANK ties, no gaps.",
      code: `SELECT a.AccountNumber, a.BranchId, a.Balance,
  ROW_NUMBER() OVER (PARTITION BY a.BranchId ORDER BY a.Balance DESC) AS rn,
  RANK()       OVER (PARTITION BY a.BranchId ORDER BY a.Balance DESC) AS rnk,
  DENSE_RANK() OVER (PARTITION BY a.BranchId ORDER BY a.Balance DESC) AS drnk,
  NTILE(4)     OVER (PARTITION BY a.BranchId ORDER BY a.Balance DESC) AS Quartile
FROM dbo.Accounts AS a
WHERE a.Status = 'ACTIVE';`,
      run: `SELECT AccountNumber, BranchId, Balance,
  ROW_NUMBER() OVER (PARTITION BY BranchId ORDER BY Balance DESC) AS rn,
  RANK()       OVER (PARTITION BY BranchId ORDER BY Balance DESC) AS rnk,
  DENSE_RANK() OVER (PARTITION BY BranchId ORDER BY Balance DESC) AS drnk
FROM Accounts WHERE Status = 'ACTIVE';`,
      viz: "rankViz",
      mem: "🥇🥈🥈🏅 → ROW_NUMBER 1,2,3,4 · RANK 1,2,2,<b>4</b> (লাফ) · DENSE_RANK 1,2,2,<b>3</b> (ঘন)",
      iq: { q: "২য় সর্বোচ্চ salary কীভাবে?", a: "<code>DENSE_RANK() = 2</code>। RANK হলে, প্রথম স্থানে দুজন tie করলে 2 বলে কেউ থাকবে না → ফাঁকা ফল।" }
    },
    {
      t: "Top-N per Group",
      bn: "প্রতি branch-এর top ৩ account। Window function ধাপ ৫-এ (SELECT) হিসাব হয়, তাই একই query-র WHERE-এ rn ব্যবহার করা যায় না → CTE-তে মুড়ে দাও।",
      en: "Wrap in a CTE — rn doesn't exist yet at WHERE (step 2).",
      code: `WITH Ranked AS (
    SELECT a.AccountNumber, a.BranchId, a.Balance,
           ROW_NUMBER() OVER (PARTITION BY a.BranchId
                              ORDER BY a.Balance DESC, a.AccountId) AS rn
    FROM dbo.Accounts AS a
    WHERE a.Status = 'ACTIVE'
)
SELECT * FROM Ranked WHERE rn <= 3;`,
      run: `WITH Ranked AS (
  SELECT AccountNumber, BranchId, Balance,
         ROW_NUMBER() OVER (PARTITION BY BranchId ORDER BY Balance DESC, AccountId) AS rn
  FROM Accounts WHERE Status = 'ACTIVE')
SELECT * FROM Ranked WHERE rn <= 2;`
    },
    {
      t: "LAG ও LEAD — প্রতিবেশীর সাথে তুলনা",
      bn: "<b>LAG</b> = আগের row-এর value, <b>LEAD</b> = পরের row-এর। তৃতীয় argument = default (প্রথম row-এ NULL-এর বদলে)।",
      en: "LAG = previous row, LEAD = next row. LAG(x, 1, 0) gives a default.",
      code: `SELECT t.AccountId, t.TxnDate, t.Amount,
  LAG(t.Amount)  OVER (PARTITION BY t.AccountId ORDER BY t.TxnDate) AS PrevAmount,
  LEAD(t.TxnDate) OVER (PARTITION BY t.AccountId ORDER BY t.TxnDate) AS NextDate,
  t.Amount - LAG(t.Amount, 1, 0) OVER (PARTITION BY t.AccountId
                                       ORDER BY t.TxnDate) AS Delta
FROM dbo.Transactions AS t;`,
      run: `SELECT AccountId, TxnDate, Amount,
  LAG(Amount) OVER (PARTITION BY AccountId ORDER BY TxnDate) AS PrevAmount,
  LEAD(TxnDate) OVER (PARTITION BY AccountId ORDER BY TxnDate) AS NextDate,
  Amount - LAG(Amount, 1, 0) OVER (PARTITION BY AccountId ORDER BY TxnDate) AS Delta
FROM Transactions WHERE AccountId = 1;`,
      viz: "lagLead",
      tip: { bn: "বাস্তব ব্যবহার: MinutesSinceLast < 1 বহু account-এ → fraud-velocity signal। আগে এর জন্য O(n²) self-join লাগত; এখন এক pass।", en: "Fraud velocity in one pass." }
    },
    {
      t: "Frame: ROWS vs RANGE 💰",
      bn: "<b>ROWS</b> = physical row গোনে। <b>RANGE</b> = একই ORDER BY value-ওয়ালা সব 'peer' row একসাথে। Frame না লিখলে default <b>RANGE</b> → একই timestamp-এর দুই transaction দুজনেই পুরো total পায় (ভুল!) আর slow-ও। নিচে দেখো।",
      en: "Omit the frame and you get RANGE — wrong running totals on duplicate keys, and slower.",
      code: `-- ৩০-transaction moving average
SELECT t.TxnDate, t.Amount,
  AVG(t.Amount) OVER (PARTITION BY t.AccountId ORDER BY t.TxnDate
                      ROWS BETWEEN 29 PRECEDING AND CURRENT ROW) AS Avg30Txns
FROM dbo.Transactions AS t;

-- Running total: সবসময় ROWS স্পষ্ট লেখো
SELECT t.TxnDate, t.Amount,
  SUM(t.Amount) OVER (PARTITION BY t.AccountId ORDER BY t.TxnDate
                      ROWS BETWEEN UNBOUNDED PRECEDING
                           AND CURRENT ROW) AS RunningTotal
FROM dbo.Transactions AS t;`,
      viz: "rowsRange",
      mem: "Running total = সবসময় <b>ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW</b> লেখো।"
    },
    {
      t: "Gaps & Islands 🏝️ (সবচেয়ে জনপ্রিয় interview প্রশ্ন)",
      bn: "টানা কয়দিন activity? কৌশল: টানা তারিখে <b>(date − row_number)</b> সবসময় একই থাকে! ফাঁক পড়লে মান বদলায় → নতুন island। নিচে তারিখে ক্লিক করে on/off করো।",
      en: "For consecutive dates, (date − row_number) is constant within a run.",
      code: `WITH Daily AS (
    SELECT DISTINCT t.AccountId, CAST(t.TxnDate AS DATE) AS ActivityDate
    FROM dbo.Transactions AS t
),
Grouped AS (
    SELECT AccountId, ActivityDate,
           DATEADD(DAY,
                   -ROW_NUMBER() OVER (PARTITION BY AccountId ORDER BY ActivityDate),
                   ActivityDate) AS IslandKey
    FROM Daily
)
SELECT AccountId,
       MIN(ActivityDate) AS StreakStart,
       MAX(ActivityDate) AS StreakEnd,
       COUNT(*)          AS StreakDays
FROM Grouped
GROUP BY AccountId, IslandKey
HAVING COUNT(*) >= 5
ORDER BY AccountId, StreakStart;`,
      run: `WITH Daily AS (SELECT DISTINCT AccountId, date(TxnDate) AS D FROM Transactions),
Grouped AS (
  SELECT AccountId, D,
    date(D, '-' || ROW_NUMBER() OVER (PARTITION BY AccountId ORDER BY D) || ' days') AS IslandKey
  FROM Daily)
SELECT AccountId, MIN(D) AS StreakStart, MAX(D) AS StreakEnd, COUNT(*) AS StreakDays
FROM Grouped GROUP BY AccountId, IslandKey
ORDER BY StreakDays DESC, AccountId;`,
      viz: "gapsIslands"
    }
  ],
  quiz: [
    { q: "Balance 900, 800, 800, 700 — RANK কী দেবে?", o: ["1,2,3,4", "1,2,2,3", "1,2,2,4", "1,1,2,3"], a: 2, e: "RANK tie-র পর লাফ দেয়।" },
    { q: "একই data-তে DENSE_RANK?", o: ["1,2,2,3", "1,2,2,4", "1,2,3,4", "1,1,1,2"], a: 0, e: "ঘন — কোনো ফাঁক নেই।" },
    { q: "Window function-এ frame না লিখলে default?", o: ["ROWS UNBOUNDED", "RANGE UNBOUNDED PRECEDING AND CURRENT ROW", "পুরো partition", "শুধু current row"], a: 1, e: "RANGE peer row যোগ করে → duplicate key-এ ভুল running total।" },
    { q: "WHERE rn <= 3 একই query-তে কেন চলে না?", o: ["Syntax", "Window ধাপ ৫-এ, WHERE ধাপ ২-এ", "rn reserved word", "চলে"], a: 1, e: "CTE/derived table-এ মুড়ে দাও।" },
    { q: "আগের row-এর value পেতে?", o: ["LEAD", "LAG", "FIRST", "PREV"], a: 1, e: "LAG = পেছনে তাকাও।" }
  ],
  cards: [
    ["OVER-এর ৩ অংশ", "PARTITION BY · ORDER BY · Frame"],
    ["RANK vs DENSE_RANK", "RANK ফাঁক রাখে (1,2,2,4); DENSE না (1,2,2,3)"],
    ["Gaps & islands কৌশল", "date − ROW_NUMBER() = island key"],
    ["Running total frame", "ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW"]
  ]
},
{
  id: 11, part: 3, icon: "🗂️",
  en: "Views, Temp Tables, and Table Variables", bn: "View, Temp Table ও Table Variable",
  pages: "34–35",
  sections: [
    {
      t: "View = সংরক্ষিত Query, Data না",
      bn: "View দেয়: security boundary (table-এ না, view-এ permission), refactor-এর সময় compatibility, জটিল join-এর একটা নাম। <b>Performance লাভ নেই</b> — view-এর text তোমার query-তে বসে যায়।",
      en: "A view is a stored query, not stored data. No performance benefit.",
      code: `CREATE OR ALTER VIEW dbo.vw_ActiveAccountSummary
AS
SELECT a.AccountId, a.AccountNumber, c.FullName, b.BranchName,
       a.AccountType, a.Balance
FROM dbo.Accounts  AS a
JOIN dbo.Customers AS c ON c.CustomerId = a.CustomerId
JOIN dbo.Branches  AS b ON b.BranchId  = a.BranchId
WHERE a.Status = 'ACTIVE';
GO
SELECT * FROM dbo.vw_ActiveAccountSummary WHERE BranchName = N'Agrabad';`,
      run: `CREATE VIEW IF NOT EXISTS vw_ActiveAccountSummary AS
SELECT a.AccountId, a.AccountNumber, c.FullName, b.BranchName, a.AccountType, a.Balance
FROM Accounts a JOIN Customers c ON c.CustomerId = a.CustomerId
JOIN Branches b ON b.BranchId = a.BranchId
WHERE a.Status = 'ACTIVE';
SELECT * FROM vw_ActiveAccountSummary;`,
      trap: { bn: "View-এর উপর view-এর উপর view = performance ধ্বংস। Optimizer ৪০-table query পায়, হাল ছেড়ে খারাপ plan দেয়। Review-তে সর্বোচ্চ ২ level।", en: "Nested views destroy performance. Max two levels." }
    },
    {
      t: "Indexed (Materialised) View",
      bn: "এখানে view আসলেই data রাখে — read তাৎক্ষণিক। খরচ: Accounts-এ প্রতিটা INSERT/UPDATE/DELETE view-ও update করে। Read-heavy report-এ দারুণ; hot write path-এ বিষ।",
      en: "Physically maintained aggregate — instant reads, costly writes.",
      code: `CREATE OR ALTER VIEW dbo.vw_BranchBalance
WITH SCHEMABINDING                       -- বাধ্যতামূলক
AS
SELECT a.BranchId,
       COUNT_BIG(*)   AS AccountCount,   -- COUNT_BIG বাধ্যতামূলক
       SUM(a.Balance) AS TotalBalance
FROM dbo.Accounts AS a                   -- two-part name বাধ্যতামূলক
GROUP BY a.BranchId;
GO
CREATE UNIQUE CLUSTERED INDEX IX_vw_BranchBalance ON dbo.vw_BranchBalance(BranchId);`
    },
    {
      t: "#Temp Table vs @Table Variable",
      bn: "মিথ: 'table variable memory-তে তাই দ্রুত' ❌। দুটোই tempdb-তে। আসল পার্থক্য = <b>Statistics</b>।",
      en: "Both live in tempdb; the real difference is statistics.",
      viz: "tempVsVar",
      code: `CREATE TABLE #HighValue (
    AccountId BIGINT NOT NULL PRIMARY KEY,
    Total     DECIMAL(19,4) NOT NULL
);
INSERT INTO #HighValue (AccountId, Total)
SELECT t.AccountId, SUM(t.Amount)
FROM dbo.Transactions AS t
WHERE t.TxnDate >= '2026-01-01'
GROUP BY t.AccountId
HAVING SUM(t.Amount) > 5000000;

CREATE INDEX IX_HV_Total ON #HighValue(Total DESC);  -- load করার পরে index

SELECT c.FullName, h.Total
FROM #HighValue AS h
JOIN dbo.Accounts  AS a ON a.AccountId  = h.AccountId
JOIN dbo.Customers AS c ON c.CustomerId = a.CustomerId
ORDER BY h.Total DESC;
DROP TABLE #HighValue;`,
      mem: "ছোট + একবার → <b>CTE</b>। দামি + বারবার / বড় → <b>#temp</b>। ১০০ row-এর কম → @table চলে।",
      iq: { q: "Procedure ১০ row-এ fast, ১ লাখে timeout। Table variable আছে। কেন?", a: "Table variable-এর statistics নেই → optimizer ১ row ধরে nested loops নেয় → ১ লাখ seek। <b>#temp</b>-এ বদলাও বা <code>OPTION (RECOMPILE)</code>।" }
    }
  ],
  quiz: [
    { q: "সাধারণ view কি performance বাড়ায়?", o: ["হ্যাঁ, cache করে", "না, query-তে expand হয়", "শুধু SELECT *-এ", "শুধু Postgres-এ"], a: 1, e: "Indexed view ছাড়া কোনো লাভ নেই।" },
    { q: "Table variable-এর estimate কত row?", o: ["আসল সংখ্যা", "১ row", "১০০ row", "১০%"], a: 1, e: "Statistics নেই।" },
    { q: "বড় intermediate result, বারবার ব্যবহার — কী?", o: ["CTE", "#temp table", "@table variable", "View"], a: 1, e: "Statistics + index + reuse।" }
  ],
  cards: [
    ["View", "Stored query, data না; security + naming"],
    ["#temp vs @var", "আসল পার্থক্য statistics; দুটোই tempdb-তে"]
  ]
},
{
  id: 12, part: 3, icon: "✏️",
  en: "Modifying Data", bn: "Data পরিবর্তন (INSERT, UPDATE…)",
  pages: "36–38",
  sections: [
    {
      t: "INSERT-এর ৪ ধরন",
      bn: "সবসময় কলামের নাম লেখো। Multi-row = এক round trip, এক transaction। <code>OUTPUT</code> দিয়ে নতুন ID ধরো।",
      en: "Name columns; multi-row; INSERT…SELECT; OUTPUT to capture keys.",
      code: `-- একটা row — কলামের নাম সবসময়
INSERT INTO dbo.Branches (BranchCode, BranchName, City, OpenedOn)
VALUES ('SYL01', N'Zindabazar', N'Sylhet', '2026-02-01');

-- Multi-row: ১ round trip
INSERT INTO dbo.Branches (BranchCode, BranchName, City, OpenedOn)
VALUES ('KHL01', N'Khulna Main', N'Khulna',   '2026-03-01'),
       ('RAJ01', N'Rajshahi',    N'Rajshahi', '2026-03-15');

-- INSERT ... SELECT: set-based load
INSERT INTO dbo.ArchivedTransactions (TxnId, AccountId, TxnDate, Amount)
SELECT TxnId, AccountId, TxnDate, Amount
FROM dbo.Transactions WHERE TxnDate < '2020-01-01';

-- OUTPUT দিয়ে নতুন key ধরো
DECLARE @NewIds TABLE (CustomerId INT);
INSERT INTO dbo.Customers (NationalId, FullName, City)
OUTPUT inserted.CustomerId INTO @NewIds
VALUES ('2001555666', N'Tanvir Ahmed', N'Dhaka');`,
      run: `INSERT INTO Branches (BranchCode, BranchName, City, OpenedOn)
VALUES ('KHL01', 'Khulna Main', 'Khulna', '2026-03-01'),
       ('RAJ01', 'Rajshahi', 'Rajshahi', '2026-03-15')
RETURNING BranchId, BranchName;`
    },
    {
      t: "JOIN দিয়ে UPDATE",
      bn: "১২ মাস কোনো transaction নেই এমন active account → DORMANT।",
      en: "T-SQL: alias in UPDATE, source in FROM.",
      code: `UPDATE a
SET a.Status = 'DORMANT'
FROM dbo.Accounts AS a
WHERE a.Status = 'ACTIVE'
  AND NOT EXISTS (SELECT 1 FROM dbo.Transactions AS t
                  WHERE t.AccountId = a.AccountId
                    AND t.TxnDate >= DATEADD(MONTH, -12, GETDATE()));`,
      trap: { bn: "UPDATE ... FROM-এর join যদি এক target row-এ একাধিক source মেলায় → error দেয় না, চুপচাপ যেকোনো একটা নেয়! Test-এ পাস করা data corruption। আগে aggregate করো বা MERGE (সে error দেয়)।", en: "UPDATE…FROM with fan-out is nondeterministic." }
    },
    {
      t: "DELETE vs TRUNCATE",
      bn: "নিচের তুলনা মনে রাখো। TRUNCATE-ও rollback করা যায় (SQL Server/Postgres-এ)!",
      en: "DELETE: logged per row, WHERE, triggers. TRUNCATE: deallocates pages, resets identity.",
      viz: "deleteTruncate"
    },
    {
      t: "Batch Delete — ২ কোটি row, outage ছাড়া",
      bn: "এক বিশাল DELETE = table lock, log বিস্ফোরণ, সবাই block, ৯০%-এ fail হলে ১ ঘণ্টা rollback। Batch করো!",
      en: "Batch large deletes: each batch is its own transaction.",
      code: `SET NOCOUNT ON;
WHILE 1 = 1
BEGIN
    DELETE TOP (5000) FROM dbo.Transactions
    WHERE TxnDate < '2019-01-01';

    IF @@ROWCOUNT = 0 BREAK;

    WAITFOR DELAY '00:00:00.100';   -- অন্যদের সুযোগ দাও
END`,
      viz: "batchDelete",
      tip: { bn: "৫০০০ ভালো শুরু — SQL Server ৫০০০ lock-এ table lock-এ escalate করে, তার নিচে থাকে।", en: "5,000 stays under lock escalation threshold." }
    },
    {
      t: "MERGE / UPSERT",
      bn: "এক statement-এ insert + update (+ delete)। মিললে UPDATE, না মিললে INSERT।",
      en: "MERGE: insert, update, delete in one statement.",
      code: `MERGE INTO dbo.Customers AS tgt
USING (SELECT NationalId, FullName, Email, City FROM dbo.CustomerStaging) AS src
   ON tgt.NationalId = src.NationalId
WHEN MATCHED AND (tgt.FullName <> src.FullName
              OR ISNULL(tgt.Email,'') <> ISNULL(src.Email,'')) THEN
    UPDATE SET tgt.FullName = src.FullName,
               tgt.Email    = src.Email,
               tgt.City     = src.City
WHEN NOT MATCHED BY TARGET THEN
    INSERT (NationalId, FullName, Email, City, KycStatus)
    VALUES (src.NationalId, src.FullName, src.Email, src.City, 'PENDING')
OUTPUT $action, inserted.CustomerId, deleted.FullName AS OldName;`,
      run: `-- SQLite/Postgres style UPSERT
INSERT INTO Customers (NationalId, FullName, Email, City, KycStatus)
VALUES ('1990123456', 'Rahim Uddin (updated)', 'rahim@new.com', 'Dhaka', 'VERIFIED')
ON CONFLICT (NationalId) DO UPDATE SET FullName = excluded.FullName, Email = excluded.Email;
SELECT * FROM Customers WHERE NationalId = '1990123456';`,
      trap: { bn: "SQL Server-এর MERGE-এ অনেক bug, আর default-এ concurrency-safe না (PK violation/deadlock)। ব্যবহার করলে <code>WITH (HOLDLOCK)</code>। সহজ upsert: UPDATE, তারপর @@ROWCOUNT = 0 হলে INSERT।", en: "Add WITH (HOLDLOCK) or avoid MERGE." },
      tip: { bn: "PostgreSQL: <code>INSERT ... ON CONFLICT DO UPDATE</code> — atomic ও সহজ। MySQL: <code>ON DUPLICATE KEY UPDATE</code>।", en: "Postgres ON CONFLICT; MySQL ON DUPLICATE KEY." }
    }
  ],
  quiz: [
    { q: "TRUNCATE কি trigger fire করে?", o: ["হ্যাঁ", "না", "শুধু AFTER", "শুধু INSTEAD OF"], a: 1, e: "Page deallocate করে, row-by-row না।" },
    { q: "TRUNCATE-এর পর IDENTITY?", o: ["চলতে থাকে", "Seed-এ reset", "NULL", "Error"], a: 1, e: "DELETE preserve করে, TRUNCATE reset করে।" },
    { q: "২ কোটি row মুছতে সেরা উপায়?", o: ["এক DELETE", "DELETE TOP(5000) loop", "Cursor", "DROP DATABASE"], a: 1, e: "প্রতি batch আলাদা transaction।" },
    { q: "Postgres-এ upsert?", o: ["MERGE only", "INSERT ... ON CONFLICT DO UPDATE", "REPLACE", "UPSERT keyword"], a: 1, e: "Atomic ও নিরাপদ।" }
  ],
  cards: [
    ["DELETE vs TRUNCATE", "DELETE: row-by-row, WHERE, trigger · TRUNCATE: page dealloc, identity reset"],
    ["বড় delete", "Batch: DELETE TOP (5000) + loop"],
    ["Upsert (Postgres)", "INSERT ... ON CONFLICT (col) DO UPDATE"]
  ]
},
// ───────────────────────────── PART IV ─────────────────────────────
{
  id: 13, part: 4, icon: "🔒",
  en: "Transactions, Isolation, and Locking", bn: "Transaction, Isolation ও Locking",
  pages: "40–43",
  sections: [
    {
      t: "টাকা হারাবে না এমন Transfer",
      bn: "মূল কৌশল: <b>XACT_ABORT ON</b> (যেকোনো error-এ পুরো rollback) + <b>UPDLOCK</b> (পড়ার সময়ই lock) + <b>নির্দিষ্ট order-এ lock</b> (deadlock এড়াতে) + TRY/CATCH।",
      en: "XACT_ABORT + UPDLOCK on read + deterministic lock order + TRY/CATCH.",
      code: `CREATE OR ALTER PROCEDURE dbo.usp_TransferFunds
    @FromAccountId BIGINT, @ToAccountId BIGINT, @Amount DECIMAL(19,4)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;            -- যেকোনো error → পুরো rollback

    IF @Amount <= 0 THROW 50001, 'Amount must be positive.', 1;
    IF @FromAccountId = @ToAccountId THROW 50002, 'Accounts must differ.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- ছোট ID আগে lock → deadlock হবে না
        DECLARE @First  BIGINT = IIF(@FromAccountId < @ToAccountId, @FromAccountId, @ToAccountId);
        DECLARE @Second BIGINT = IIF(@FromAccountId < @ToAccountId, @ToAccountId, @FromAccountId);
        DECLARE @Bal DECIMAL(19,4);

        SELECT @Bal = Balance FROM dbo.Accounts WITH (UPDLOCK, ROWLOCK) WHERE AccountId = @First;
        SELECT 1             FROM dbo.Accounts WITH (UPDLOCK, ROWLOCK) WHERE AccountId = @Second;

        SELECT @Bal = Balance FROM dbo.Accounts WHERE AccountId = @FromAccountId;
        IF @Bal IS NULL    THROW 50003, 'Account not found.', 1;
        IF @Bal < @Amount  THROW 50004, 'Insufficient funds.', 1;

        UPDATE dbo.Accounts SET Balance = Balance - @Amount WHERE AccountId = @FromAccountId;
        UPDATE dbo.Accounts SET Balance = Balance + @Amount WHERE AccountId = @ToAccountId;

        INSERT INTO dbo.Transactions (AccountId, TxnDate, TxnType, Channel, Amount, BalanceAfter, Reference)
        SELECT @FromAccountId, SYSUTCDATETIME(), 'DEBIT', 'ONLINE', @Amount, Balance, N'Transfer out'
        FROM dbo.Accounts WHERE AccountId = @FromAccountId;
        -- (credit side একইভাবে)

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;                     -- original error আবার ছোঁড়ো
    END CATCH
END`,
      viz: "transferRace",
      mem: "UPDLOCK ছাড়া: দুইজন একসাথে Tk 1000 দেখে, দুজনেই Tk 800 তোলে → balance <b>−600</b> 😱"
    },
    {
      t: "৪টা Concurrency সমস্যা",
      bn: "👻 <b>Dirty read</b> — অন্যের uncommitted পরিবর্তন পড়লে, সে rollback করল → তোমার value কখনো ছিলই না।<br>🔄 <b>Non-repeatable read</b> — একই row দুইবার পড়ে আলাদা value (মাঝে কেউ UPDATE করেছে)।<br>👤 <b>Phantom read</b> — একই WHERE দুইবার, row সংখ্যা আলাদা (কেউ INSERT করেছে)।<br>💥 <b>Lost update</b> — দুজন read-modify-write; দ্বিতীয়জন প্রথমজনের কাজ মুছে দেয়।",
      en: "Dirty read, non-repeatable read, phantom read, lost update."
    },
    {
      t: "Isolation Level 🎚️",
      bn: "Level বদলাও — কোন সমস্যা আটকায় দেখো।",
      en: "Higher isolation = fewer anomalies, less concurrency.",
      viz: "isolation",
      code: `SET TRANSACTION ISOLATION LEVEL SNAPSHOT;
BEGIN TRANSACTION;
  -- transaction শুরুর মুহূর্তের consistent snapshot দেখে
  SELECT SUM(Balance) FROM dbo.Accounts WHERE BranchId = 1;
  WAITFOR DELAY '00:00:05';
  SELECT SUM(Balance) FROM dbo.Accounts WHERE BranchId = 1;  -- হুবহু একই
COMMIT;`,
      trap: { bn: "<code>WITH (NOLOCK)</code> = ছদ্মবেশী READ UNCOMMITTED, এবং আরও খারাপ: page split-এর সময় একই row দুইবার পড়তে পারে বা committed row বাদ দিতে পারে। 'একটু পুরনো' না — <b>এলোমেলো ভুল</b>। Non-blocking read চাইলে READ_COMMITTED_SNAPSHOT চালু করো।", en: "NOLOCK is arbitrarily wrong. Use RCSI." }
    },
    {
      t: "Optimistic vs Pessimistic",
      bn: "🔒 <b>Pessimistic</b> (UPDLOCK) — পুরো সময় lock ধরে রাখে; ছোট server-side transaction-এ।<br>🎫 <b>Optimistic</b> (ROWVERSION) — lock নেই; লেখার সময় version মিলিয়ে দেখো। User form edit-এর মতো দীর্ঘ কাজে (EF Core-এর [Timestamp])।",
      en: "Pessimistic: hold a lock. Optimistic: check a rowversion on write.",
      code: `ALTER TABLE dbo.Accounts ADD RowVer ROWVERSION;
GO

-- practice: app যা পাঠাবে
DECLARE @AccountId BIGINT = 1, @NewBalance DECIMAL(19,4) = 90000;
DECLARE @OriginalRowVer BINARY(8) =
    (SELECT RowVer FROM dbo.Accounts WHERE AccountId = @AccountId);  -- পড়ার সময়ের version

UPDATE dbo.Accounts
SET Balance = @NewBalance
WHERE AccountId = @AccountId
  AND RowVer    = @OriginalRowVer;   -- যে version পড়েছিলাম

IF @@ROWCOUNT = 0
    THROW 50010, 'Record was modified by another user. Reload and retry.', 1;`
    },
    {
      t: "Deadlock 🔁",
      bn: "Deadlock = চক্র: A-র কাছে lock 1, চায় lock 2; B-র কাছে lock 2, চায় lock 1। Engine একজনকে victim বানিয়ে rollback করে (error <b>1205</b>)। ▶ চাপো।<br><b>৩ প্রতিরক্ষা:</b> ① সবসময় একই order-এ lock ② ছোট transaction (HTTP call-এর সময় transaction খোলা রেখো না) ③ ভালো index।",
      en: "A lock cycle; the engine kills a victim (1205). Consistent ordering, short transactions, good indexes.",
      viz: "deadlock",
      code: `-- ℹ️ আগে উপরের dbo.usp_TransferFunds procedure-টা তৈরি করো
-- Deadlock transient, তাই retry করো
DECLARE @Retry INT = 3;
WHILE @Retry > 0
BEGIN
    BEGIN TRY
        EXEC dbo.usp_TransferFunds @FromAccountId=1, @ToAccountId=2, @Amount=500;
        BREAK;                                        -- সফল
    END TRY
    BEGIN CATCH
        SET @Retry -= 1;
        IF ERROR_NUMBER() <> 1205 OR @Retry = 0 THROW; -- deadlock না → হাল ছাড়ো
        WAITFOR DELAY '00:00:00.200';                 -- একটু থেমে আবার
    END CATCH
END`,
      iq: { q: "Deadlock vs Blocking?", a: "<b>Blocking</b> = স্বাভাবিক ও অস্থায়ী অপেক্ষা, নিজে মিটে যায় (performance সমস্যা)। <b>Deadlock</b> = স্থায়ী চক্র, engine একজনকে মারে (correctness/retry সমস্যা)।" }
    }
  ],
  quiz: [
    { q: "কোন isolation level phantom read আটকায়?", o: ["READ COMMITTED", "REPEATABLE READ", "SERIALIZABLE", "READ UNCOMMITTED"], a: 2, e: "Range lock দিয়ে। SNAPSHOT-ও আটকায় (versioning)।" },
    { q: "Deadlock error number?", o: ["50000", "1205", "547", "2627"], a: 1, e: "Retry করা যায় কারণ transient।" },
    { q: "Deadlock এড়ানোর সবচেয়ে গুরুত্বপূর্ণ উপায়?", o: ["NOLOCK", "Consistent lock ordering", "বড় transaction", "Index মুছে ফেলা"], a: 1, e: "সবাই ascending AccountId order-এ lock নিলে চক্র অসম্ভব।" },
    { q: "WITH (NOLOCK) সম্পর্কে সঠিক?", o: ["নিরাপদ ও দ্রুত", "একই row দুইবার পড়তে বা বাদ দিতে পারে", "Snapshot দেয়", "Deadlock বাড়ায়"], a: 1, e: "Arbitrarily wrong। RCSI ব্যবহার করো।" },
    { q: "দীর্ঘ user form edit-এর জন্য?", o: ["Pessimistic UPDLOCK", "Optimistic ROWVERSION", "SERIALIZABLE", "TABLOCK"], a: 1, e: "কেউ ফোন ধরলে lock ধরে রাখা যায় না।" }
  ],
  cards: [
    ["UPDLOCK কেন?", "পড়ার সময়ই lock → দুই transfer একসাথে balance পড়তে পারে না"],
    ["Deadlock-এর ৩ প্রতিরক্ষা", "Lock order · ছোট transaction · ভালো index"],
    ["NOLOCK", "ব্যবহার কোরো না; READ_COMMITTED_SNAPSHOT চালু করো"],
    ["Isolation levels", "RU < RC < RR < SERIALIZABLE; SNAPSHOT = versioning"]
  ]
},
{
  id: 14, part: 4, icon: "🧩",
  en: "Stored Procedures and Functions", bn: "Stored Procedure ও Function",
  pages: "44–46",
  sections: [
    {
      t: "Production Procedure-এর গঠন",
      bn: "মুখস্থ রাখার মতো template: SET NOCOUNT ON → XACT_ABORT → validation (THROW) → half-open date → count → paged result।",
      en: "The template worth memorising.",
      code: `CREATE OR ALTER PROCEDURE dbo.usp_GetAccountStatement
    @AccountId  BIGINT,
    @FromDate   DATE,
    @ToDate     DATE,
    @PageNumber INT = 1,
    @PageSize   INT = 50,
    @TotalRows  INT = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;        -- "n rows affected" বন্ধ
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Accounts WHERE AccountId = @AccountId)
        THROW 50020, 'Account does not exist.', 1;
    IF @ToDate < @FromDate
        THROW 50021, 'ToDate must be on or after FromDate.', 1;

    DECLARE @ToExclusive DATETIME2(3) = DATEADD(DAY, 1, CAST(@ToDate AS DATETIME2(3)));

    SELECT @TotalRows = COUNT(*)
    FROM dbo.Transactions
    WHERE AccountId = @AccountId
      AND TxnDate >= @FromDate AND TxnDate < @ToExclusive;

    SELECT t.TxnId, t.TxnDate, t.TxnType, t.Channel, t.Amount, t.BalanceAfter, t.Reference
    FROM dbo.Transactions AS t
    WHERE t.AccountId = @AccountId
      AND t.TxnDate >= @FromDate AND t.TxnDate < @ToExclusive
    ORDER BY t.TxnDate DESC, t.TxnId DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END`,
      tip: { bn: "SET NOCOUNT ON সাজসজ্জা না — প্রতিটা '(1 row affected)' আলাদা network packet। ১০,০০০ loop = ১০,০০০ বাড়তি packet। প্রতিটা procedure-এর প্রথম লাইন।", en: "SET NOCOUNT ON first, always." }
    },
    {
      t: "ORM-এর যুগেও Procedure কেন?",
      bn: "🛡 <b>Security</b> — শুধু EXECUTE permission, table-এ না → injection-এর ঝুঁকি শূন্য।<br>📜 <b>Contract</b> — signature = interface; নিচের table বদলালেও app redeploy লাগে না।<br>🔁 <b>Round trip</b> — ১০ statement = ১ EXEC।<br>💾 <b>Plan caching</b> — stable plan (যা আবার parameter sniffing-এর কারণ, Ch 22)।",
      en: "Security, contract, fewer round trips, plan caching."
    },
    {
      t: "Scalar Function — Performance ফাঁদ ☠️",
      bn: "নিরীহ দেখায়, কিন্তু: (১) প্রতি row-এ একবার চলে (২.৫ লাখ বার!) (২) optimizer-এর কাছে কালো বাক্স, খরচ ধরে শূন্য (৩) <b>পুরো query-র parallelism বন্ধ</b>। ১০ সেকেন্ডের report → ১০ মিনিট।",
      en: "Multi-statement scalar UDFs: per-row, opaque, kill parallelism.",
      code: `CREATE OR ALTER FUNCTION dbo.fn_GetCustomerTier (@CustomerId INT)
RETURNS VARCHAR(10)
AS
BEGIN
    DECLARE @Total DECIMAL(19,4);
    SELECT @Total = SUM(Balance) FROM dbo.Accounts WHERE CustomerId = @CustomerId;
    RETURN CASE WHEN @Total >= 1000000 THEN 'PLATINUM'
                WHEN @Total >=  500000 THEN 'GOLD'
                ELSE 'STANDARD' END;
END
GO
-- নিরীহ দেখায়। ২.৫ লাখ বার ROW BY ROW চলে, single-threaded!
SELECT c.CustomerId, c.FullName, dbo.fn_GetCustomerTier(c.CustomerId) AS Tier
FROM dbo.Customers AS c;`,
      viz: "scalarVsInline"
    },
    {
      t: "Inline TVF — ভালো ধরনের Function ✅",
      bn: "<code>RETURNS TABLE AS RETURN SELECT ...</code> = parameter-ওয়ালা view। Optimizer ভিতরটা দেখতে পায়, inline করে, parallel চলে।",
      en: "Single-statement inline TVFs are inlined and safe.",
      code: `CREATE OR ALTER FUNCTION dbo.tvf_CustomerTier ()
RETURNS TABLE
AS
RETURN
    SELECT a.CustomerId,
           SUM(a.Balance) AS TotalBalance,
           CASE WHEN SUM(a.Balance) >= 1000000 THEN 'PLATINUM'
                WHEN SUM(a.Balance) >=  500000 THEN 'GOLD'
                ELSE 'STANDARD' END AS Tier
    FROM dbo.Accounts AS a
    WHERE a.Status = 'ACTIVE'
    GROUP BY a.CustomerId;
GO
-- একটা set-based join। Parallel-capable।
SELECT c.FullName, t.Tier, t.TotalBalance
FROM dbo.Customers AS c
JOIN dbo.tvf_CustomerTier() AS t ON t.CustomerId = c.CustomerId;`,
      mem: "🚫 <b>Function-এর ভিতরে কখনো BEGIN লিখো না।</b> BEGIN...END = কালো বাক্স।"
    },
    {
      t: "Table-Valued Parameter (TVP)",
      bn: "App থেকে একটা call-এ পুরো set পাঠাও। বিকল্প দুই anti-pattern: বিশাল IN ('1','2',...,'5000') string, বা ৫০০০ বার loop call।",
      en: "Send a set from the app in one call.",
      code: `CREATE TYPE dbo.AccountIdList AS TABLE (AccountId BIGINT NOT NULL PRIMARY KEY);
GO
CREATE OR ALTER PROCEDURE dbo.usp_GetBalances
    @Accounts dbo.AccountIdList READONLY     -- TVP সবসময় READONLY
AS
BEGIN
    SET NOCOUNT ON;
    SELECT a.AccountId, a.AccountNumber, a.Balance
    FROM dbo.Accounts AS a
    JOIN @Accounts AS p ON p.AccountId = a.AccountId;
END
-- C#: DataTable + SqlDbType.Structured`
    }
  ],
  quiz: [
    { q: "কোন function optimizer inline করে?", o: ["Multi-statement scalar UDF", "RETURNS TABLE AS RETURN SELECT ...", "BEGIN...END TVF", "সবগুলো"], a: 1, e: "Inline TVF = parameterised view।" },
    { q: "Scalar UDF-এর সবচেয়ে বড় ক্ষতি?", o: ["বেশি disk", "পুরো query-র parallelism বন্ধ + প্রতি row-এ চলে", "Syntax জটিল", "Security"], a: 1, e: "১০ সেকেন্ড → ১০ মিনিট।" },
    { q: "SET NOCOUNT ON কেন?", o: ["Cosmetic", "প্রতি statement-এর বাড়তি network packet বন্ধ", "Error লুকায়", "Transaction শুরু করে"], a: 1, e: "Loop-এ হাজার হাজার packet বাঁচে।" }
  ],
  cards: [
    ["Function rule", "Function-এ কখনো BEGIN না — inline TVF ব্যবহার করো"],
    ["TVP", "App থেকে set পাঠাও; READONLY"],
    ["Procedure-এর প্রথম লাইন", "SET NOCOUNT ON; SET XACT_ABORT ON;"]
  ]
},
{
  id: 15, part: 4, icon: "⚡",
  en: "Triggers", bn: "Trigger",
  pages: "47–48",
  sections: [
    {
      t: "Audit Trigger",
      bn: "<b>inserted</b> (নতুন value) আর <b>deleted</b> (পুরনো value) হলো <b>table</b>, row না! Trigger প্রতি statement-এ একবার fire করে — ১০,০০০ row update হলে inserted-এ ১০,০০০ row।",
      en: "inserted and deleted are tables. A trigger fires once per statement.",
      code: `CREATE OR ALTER TRIGGER dbo.trg_Accounts_Audit
ON dbo.Accounts
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF ROWCOUNT_BIG() = 0 RETURN;                          -- কিছু বদলায়নি
    IF NOT UPDATE(Balance) AND NOT UPDATE(Status) RETURN;  -- column filter

    INSERT INTO dbo.AccountAudit
        (AccountId, OldBalance, NewBalance, OldStatus, NewStatus, ChangedBy, ChangedAt)
    SELECT i.AccountId, d.Balance, i.Balance, d.Status, i.Status,
           SUSER_SNAME(), SYSUTCDATETIME()
    FROM inserted AS i
    JOIN deleted  AS d ON d.AccountId = i.AccountId
    WHERE i.Balance <> d.Balance OR i.Status <> d.Status;
END`,
      viz: "triggerTables",
      trap: { bn: "Junior bug: <code>SELECT @Id = AccountId FROM inserted</code> — যেকোনো একটা row নেয়, বাকি ৯,৯৯৯ উপেক্ষা!", en: "Never assign inserted to a scalar variable." }
    },
    {
      t: "INSTEAD OF Trigger",
      bn: "Multi-table view-কে updatable বানায় — UPDATE-এর বদলে তোমার code চলে।",
      en: "Makes a multi-table view updatable.",
      code: `-- ℹ️ আগে Chapter 11-এর dbo.vw_ActiveAccountSummary view তৈরি করো
CREATE OR ALTER TRIGGER dbo.trg_vw_ActiveAccount_Update
ON dbo.vw_ActiveAccountSummary
INSTEAD OF UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE a SET a.AccountType = i.AccountType
    FROM dbo.Accounts AS a JOIN inserted AS i ON i.AccountId = a.AccountId;

    UPDATE c SET c.FullName = i.FullName
    FROM dbo.Customers AS c
    JOIN dbo.Accounts  AS a ON a.CustomerId = c.CustomerId
    JOIN inserted      AS i ON i.AccountId  = a.AccountId;
END`
    },
    {
      t: "কখন Trigger ব্যবহার করবে না",
      bn: "Trigger <b>অদৃশ্য</b>: caller-এর transaction-এর ভিতরে চলে, সময় বাড়ায়, lock যোগ করে, rollback করতে পারে — app code-এ কিছুই দেখা যায় না। Debugging = প্রত্নতত্ত্ব।<br>✅ ব্যবহার করো: bypass করা যায় না এমন audit, constraint যা পারে না এমন নিয়ম।<br>❌ না: business logic, cross-DB call, email পাঠানো। Trigger-এ cursor কখনো না।",
      en: "Use triggers for unbypassable audit and invariants only.",
      iq: { q: "৫০,০০০ row INSERT-এ ৪০ মিনিট। Table-এ trigger আছে। Diagnose।", a: "Trigger প্রায় নিশ্চিত row-at-a-time (inserted-এর উপর cursor, বা scalar variable)। Set-based এক statement-এ rewrite → সেকেন্ডে নামবে। Trigger-এর ভিতরে trigger (nesting ৩২ level পর্যন্ত) চেক করো।" }
    }
  ],
  quiz: [
    { q: "১০,০০০ row UPDATE-এ AFTER trigger কতবার fire করে?", o: ["১০,০০০", "১", "২", "০"], a: 1, e: "প্রতি statement-এ একবার।" },
    { q: "inserted/deleted কী?", o: ["Variable", "Table (pseudo-table)", "Function", "Cursor"], a: 1, e: "অনেক row থাকতে পারে।" },
    { q: "Trigger-এ কোনটা উচিত?", o: ["Email পাঠানো", "Audit log", "Business logic", "Cursor"], a: 1, e: "Bypass-অযোগ্য audit।" }
  ],
  cards: [
    ["Trigger fire হয়", "প্রতি statement-এ একবার, প্রতি row-এ না"],
    ["inserted / deleted", "নতুন / পুরনো value-এর table"]
  ]
},
{
  id: 16, part: 4, icon: "🔄",
  en: "Loops, Cursors, and Thinking in Sets", bn: "Loop, Cursor ও Set-এ চিন্তা",
  pages: "49–52",
  sections: [
    {
      t: "SQL-এ Loop কেন slow",
      bn: "App-এ ১০ লাখ item-এর array loop = ঠিক আছে (memory)। SQL-এ cursor-এর প্রতিটা iteration = আলাদা fetch, lock, plan lookup। Cursor সাধারণত <b>১০ থেকে ১০০০ গুণ</b> slow। ▶ রেস দেখো।",
      en: "A cursor is typically 10–1000× slower than the set-based equivalent.",
      viz: "cursorRace",
      mem: "'প্রতিটা row-এ X কীভাবে করব?' ❌ → 'শেষ অবস্থা বর্ণনা করে এক statement কী?' ✅"
    },
    {
      t: "Cursor — পুরো syntax (legacy code পড়ার জন্য)",
      bn: "সঠিক, কিন্তু ভুল টুল। ৪ লাখ account-এ কয়েক মিনিট, ৮ লাখ আলাদা statement।",
      en: "Correct, and still the wrong tool.",
      code: `DECLARE @AccountId BIGINT, @Balance DECIMAL(19,4), @Fee DECIMAL(19,4);

DECLARE account_cursor CURSOR
    LOCAL            -- batch-এর বাইরে দেখা যায় না
    FAST_FORWARD     -- forward-only + read-only: সবচেয়ে দ্রুত
FOR
    SELECT AccountId, Balance FROM dbo.Accounts
    WHERE Status = 'ACTIVE' AND AccountType = 'SAVINGS';

OPEN account_cursor;
FETCH NEXT FROM account_cursor INTO @AccountId, @Balance;

WHILE @@FETCH_STATUS = 0      -- 0 = success, -1 = শেষ
BEGIN
    SET @Fee = CASE WHEN @Balance <  5000 THEN 500
                    WHEN @Balance < 20000 THEN 200
                    ELSE 0 END;
    IF @Fee > 0
    BEGIN
        UPDATE dbo.Accounts SET Balance = Balance - @Fee WHERE AccountId = @AccountId;
        INSERT INTO dbo.Transactions (AccountId, TxnDate, TxnType, Channel, Amount, BalanceAfter, Reference)
        VALUES (@AccountId, SYSUTCDATETIME(), 'DEBIT', 'BRANCH', @Fee, @Balance - @Fee, N'Monthly maintenance fee');
    END
    FETCH NEXT FROM account_cursor INTO @AccountId, @Balance;  -- ভুলে যাওয়া সহজ
END

CLOSE account_cursor;
DEALLOCATE account_cursor;     -- ভুললে cursor leak`,
      tip: { bn: "Cursor লাগলেই <b>LOCAL FAST_FORWARD</b>। Default GLOBAL DYNAMIC অনেক slow — শুধু এটা বদলালেই ৬০–৮০% সময় বাঁচে।", en: "Always LOCAL FAST_FORWARD." }
    },
    {
      t: "একই কাজ, Set-based — সেকেন্ডে",
      bn: "দুটো statement, ৮ লাখ না। <code>OUTPUT</code> clause জানিয়ে দেয় কোন row বদলাল ও নতুন value কী — যে কারণে লোকে cursor নেয়।",
      en: "Two statements instead of 800,000. OUTPUT is the key.",
      code: `BEGIN TRANSACTION;
DECLARE @Charged TABLE (AccountId BIGINT, Fee DECIMAL(19,4), NewBalance DECIMAL(19,4));

UPDATE a
SET a.Balance = a.Balance - v.Fee
OUTPUT inserted.AccountId, v.Fee, inserted.Balance INTO @Charged
FROM dbo.Accounts AS a
CROSS APPLY (VALUES (CASE WHEN a.Balance <  5000 THEN 500
                          WHEN a.Balance < 20000 THEN 200
                          ELSE 0 END)) AS v(Fee)
WHERE a.Status = 'ACTIVE' AND a.AccountType = 'SAVINGS'
  AND v.Fee > 0;

INSERT INTO dbo.Transactions (AccountId, TxnDate, TxnType, Channel, Amount, BalanceAfter, Reference)
SELECT c.AccountId, SYSUTCDATETIME(), 'DEBIT', 'BRANCH', c.Fee, c.NewBalance, N'Monthly maintenance fee'
FROM @Charged AS c;
COMMIT TRANSACTION;`
    },
    {
      t: "Set-based অনুবাদ টেবিল 📖",
      bn: "Loop লিখতে হাত চুলকালে আগে এখানে দেখো। কার্ডে ক্লিক করো।",
      en: "Translation table: loop → set-based tool.",
      viz: "translation"
    },
    {
      t: "WHILE loop — যখন loop সঠিক",
      bn: "Row-এর উপর না, <b>batch</b>-এর উপর loop — এটা বৈধ। বাইরে loop, ভিতরে set-based।",
      en: "Loop over batches, set-based within each batch.",
      code: `-- ৬ কোটি row backfill, ৪ ঘণ্টার এক transaction ছাড়া
DECLARE @BatchSize INT = 10000, @Rows INT = 1;
WHILE @Rows > 0
BEGIN
    UPDATE TOP (@BatchSize) t
    SET t.Channel = 'ONLINE'
    FROM dbo.Transactions AS t
    WHERE t.Channel = 'WEB';          -- প্রতি pass-এ predicate ছোট হয়

    SET @Rows = @@ROWCOUNT;
    CHECKPOINT;
    WAITFOR DELAY '00:00:00.050';
END`,
      mem: "Cursor-এর বৈধ ব্যবহার: ① object-এর উপর admin কাজ (index rebuild) ② বদলানো যায় না এমন procedure প্রতি row ③ সত্যিকারের sequential dependency (বিরল) ④ batching।",
      iq: { q: "কখন cursor ব্যবহার করবে?", a: "\"Data-র জন্য প্রায় কখনো না। বড় পরিবর্তন WHILE loop-এ batch করে; cursor শুধু object-এর উপর admin কাজে বা বদলানো যায় না এমন procedure প্রতি row call করতে। Row-by-row data কাজে আগে window function, APPLY বা MERGE খুঁজি।\" ❌ \"যখন loop লাগে।\"" }
    },
    {
      t: "RBAR ও N+1 সমস্যা (App code-এ)",
      bn: "RBAR = Row-By-Agonising-Row। এটা syntax না, <b>মানসিকতা</b>। T-SQL-এ cursor, C#-এ lazy loading-ওয়ালা foreach।",
      en: "The N+1 problem is a cursor that runs in your web server.",
      code: `// ❌ N+1: 1001 round trip
var customers = db.Customers.Where(c => c.City == "Dhaka").ToList(); // 1 query
foreach (var c in customers)
{
    // lazy loading → প্রতি customer-এ একটা SELECT: আরও 1000
    Console.WriteLine($"{c.FullName}: {c.Accounts.Count}");
}

// ✅ এক query
var data = db.Customers
    .Where(c => c.City == "Dhaka")
    .Select(c => new { c.FullName, AccountCount = c.Accounts.Count() })
    .ToList();   // এক round trip, server-side GROUP BY`,
      viz: "nPlusOne"
    }
  ],
  quiz: [
    { q: "Running total per row-এর set-based টুল?", o: ["Cursor", "SUM() OVER (ORDER BY ... ROWS ...)", "WHILE", "Trigger"], a: 1, e: "Window function।" },
    { q: "Cursor লাগলে কোন option?", o: ["GLOBAL DYNAMIC", "LOCAL FAST_FORWARD", "SCROLL", "KEYSET"], a: 1, e: "৬০–৮০% দ্রুত।" },
    { q: "Hierarchy হাঁটতে?", o: ["Cursor", "Recursive CTE", "PIVOT", "UNION"], a: 1, e: "Anchor + recursive member।" },
    { q: "লিখে দেওয়া row-এর ID দরকার?", o: ["SELECT MAX(Id)", "OUTPUT clause", "@@IDENTITY loop", "Cursor"], a: 1, e: "OUTPUT inserted.Id।" }
  ],
  cards: [
    ["Cursor vs set", "Cursor ১০–১০০০× slow"],
    ["বৈধ loop", "Batch-এর উপর loop, ভিতরে set-based"],
    ["N+1", "Lazy loading foreach → এক projected query"]
  ]
}
);
