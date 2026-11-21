CHAPTERS.push(
{
  id: 17, part: 4, icon: "💉",
  en: "Dynamic SQL and Injection", bn: "Dynamic SQL ও SQL Injection",
  pages: "53–54",
  sections: [
    {
      t: "সঠিক উপায় vs বিপর্যয়কর উপায় 🎮",
      bn: "নিচে input-এ <code>'; DROP TABLE Accounts; --</code> লিখে দেখো string concatenation কী বানায়, আর parameter কী করে।",
      en: "String concatenation = injection. sp_executesql with parameters = safe.",
      viz: "injection",
      code: `-- ❌ কখনো না। @City = '''; DROP TABLE dbo.Accounts; --' → career শেষ
DECLARE @sql NVARCHAR(MAX) =
    N'SELECT * FROM dbo.Customers WHERE City = ''' + @City + N'''';
EXEC (@sql);

-- ✅ sp_executesql: parameterised, cached, safe
DECLARE @sql NVARCHAR(MAX) = N'
    SELECT c.CustomerId, c.FullName, c.City
    FROM dbo.Customers AS c
    WHERE 1 = 1';
IF @City IS NOT NULL SET @sql += N' AND c.City = @pCity';
IF @Kyc  IS NOT NULL SET @sql += N' AND c.KycStatus = @pKyc';

EXEC sys.sp_executesql @sql,
     N'@pCity NVARCHAR(60), @pKyc VARCHAR(12)',  -- parameter DEFINITION
     @pCity = @City, @pKyc = @Kyc;                -- parameter VALUES`,
      mem: "Parameter value statement text থেকে <b>আলাদা</b> পাঠানো হয়, কখনো SQL হিসেবে parse হয় না → injection <b>গঠনগতভাবে অসম্ভব</b>। বোনাস: plan cache-এ একটা entry।"
    },
    {
      t: "Identifier parameter হতে পারে না",
      bn: "Table/column-এর নাম parameter করা যায় না। লাগলে: আগে <b>whitelist</b>, তারপর <b>QUOTENAME</b>।",
      en: "Whitelist first, QUOTENAME second.",
      code: `DECLARE @SortColumn SYSNAME = @UserInput;

IF @SortColumn NOT IN (N'Balance', N'OpenedOn', N'AccountNumber')
    THROW 50030, 'Invalid sort column.', 1;          -- আগে WHITELIST

DECLARE @sql NVARCHAR(MAX) =
    N'SELECT AccountNumber, Balance FROM dbo.Accounts ORDER BY '
    + QUOTENAME(@SortColumn);                         -- defence in depth
EXEC sys.sp_executesql @sql;`,
      trap: { bn: "শুধু QUOTENAME যথেষ্ট না — escape আটকায়, কিন্তু user যে কলাম দেখা উচিত না সেটাও quote করে দেয়। আগে whitelist!", en: "QUOTENAME alone is not enough." }
    },
    {
      t: "Optional-parameter সমস্যা ('kitchen sink')",
      bn: "<code>(@X IS NULL OR Col = @X)</code> — সুবিধাজনক, কিন্তু একটা cached plan যা বাকি সব combination-এর জন্য ভুল।",
      en: "One plan for all NULL combinations is wrong for most.",
      code: `-- সুবিধাজনক কিন্তু একটা খারাপ plan
SELECT * FROM dbo.Accounts
WHERE (@BranchId IS NULL OR BranchId    = @BranchId)
  AND (@Type     IS NULL OR AccountType = @Type)
  AND (@MinBal   IS NULL OR Balance    >= @MinBal);

-- ওষুধ ১: প্রতি call-এ নতুন plan
... OPTION (RECOMPILE);

-- ওষুধ ২: dynamic SQL — শুধু দেওয়া predicate গুলো যোগ করো
-- প্রতিটা আলাদা shape নিজের optimal cached plan পায়`,
      tip: { bn: "PostgreSQL: <code>EXECUTE format('...%I...', col) USING val</code> — %I identifier quote করে। MySQL: PREPARE/EXECUTE USING।", en: "Postgres format() with %I and USING." }
    }
  ],
  quiz: [
    { q: "Parameterised query কেন injection-proof?", o: ["Escape করে", "Value আলাদা পাঠানো হয়, SQL হিসেবে parse হয় না", "Encrypt করে", "Firewall"], a: 1, e: "গঠনগতভাবে অসম্ভব।" },
    { q: "ORDER BY-এর কলাম user থেকে এলে?", o: ["Parameter দাও", "Whitelist + QUOTENAME", "শুধু QUOTENAME", "Concatenate"], a: 1, e: "Identifier parameter হতে পারে না।" },
    { q: "Kitchen-sink query-র সহজ ওষুধ?", o: ["NOLOCK", "OPTION (RECOMPILE)", "Cursor", "Index মুছো"], a: 1, e: "বা dynamic SQL।" }
  ],
  cards: [
    ["Injection থেকে বাঁচো", "sp_executesql + parameters"],
    ["Dynamic identifier", "Whitelist → QUOTENAME"]
  ]
},
{
  id: 18, part: 4, icon: "🚨",
  en: "Error Handling", bn: "Error Handling",
  pages: "55–56",
  sections: [
    {
      t: "সঠিক Error-handling কাঠামো",
      bn: "TRY → BEGIN TRAN → কাজ → COMMIT। CATCH → <code>XACT_STATE() <> 0</code> হলে ROLLBACK → log → bare <code>THROW;</code>।",
      en: "The correct skeleton: TRY/CATCH, XACT_STATE, log, bare THROW.",
      code: `CREATE OR ALTER PROCEDURE dbo.usp_CloseAccount @AccountId BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        IF EXISTS (SELECT 1 FROM dbo.Accounts
                   WHERE AccountId = @AccountId AND Balance <> 0)
            THROW 50040, 'Cannot close an account with a non-zero balance.', 1;

        UPDATE dbo.Accounts
        SET Status = 'CLOSED', ClosedOn = CAST(SYSUTCDATETIME() AS DATE)
        WHERE AccountId = @AccountId AND Status <> 'CLOSED';

        IF @@ROWCOUNT = 0 THROW 50041, 'Account not found or already closed.', 1;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;

        INSERT INTO dbo.ErrorLog (ErrorNumber, ErrorMessage, ErrorProcedure, ErrorLine, LoggedAt)
        VALUES (ERROR_NUMBER(), ERROR_MESSAGE(), ERROR_PROCEDURE(), ERROR_LINE(), SYSUTCDATETIME());

        THROW;   -- bare THROW = original error হুবহু আবার
    END CATCH
END`,
      viz: "tryCatchFlow",
      trap: { bn: "TRY/CATCH ধরে না: একই batch-এ compile error ও object-name error, severity 20+ (connection মারা যায়), KILL। <code>XACT_STATE() = -1</code> মানে doomed — শুধু rollback। @@TRANCOUNT চেক করা কমন bug।", en: "Use XACT_STATE(), not @@TRANCOUNT." }
    },
    {
      t: "THROW vs RAISERROR",
      bn: "<b>THROW</b> (2012+): severity সবসময় 16, bare THROW সব রেখে আবার ছোঁড়ে, ≥ 50000 যেকোনো ID। → <b>এটাই ব্যবহার করো</b>।<br><b>RAISERROR</b> (legacy): severity বেছে নাও, printf formatting, original preserve করতে পারে না। → শুধু formatting/severity লাগলে।",
      en: "Use THROW; RAISERROR only for formatting or severity control."
    },
    {
      t: "Nested Transaction একটা মিথ্যা 🤥",
      bn: "BEGIN TRAN-এর ভিতরে BEGIN TRAN শুধু <b>@@TRANCOUNT বাড়ায়</b>। ভিতরের COMMIT কিছুই commit করে না! কিন্তু ভিতরের ROLLBACK <b>সব</b> rollback করে ও count 0 করে। আংশিক rollback চাইলে <b>SAVE TRANSACTION</b>। ▶ খেলো।",
      en: "Inner COMMIT commits nothing; inner ROLLBACK rolls back everything. Use savepoints.",
      viz: "trancount",
      code: `CREATE OR ALTER PROCEDURE dbo.usp_ChildOperation
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Started BIT = 0, @sp SYSNAME = 'sp_' + CAST(@@NESTLEVEL AS VARCHAR(4));

    IF @@TRANCOUNT = 0 BEGIN BEGIN TRANSACTION; SET @Started = 1; END
    ELSE SAVE TRANSACTION @sp;         -- savepoint, transaction না

    BEGIN TRY
        INSERT INTO dbo.Loans (CustomerId, BranchId, Principal, InterestRate, TermMonths, DisbursedOn, Status)
        VALUES (1, 1, 500000, 9.50, 36, GETDATE(), 'ACTIVE');
        IF @Started = 1 COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @Started = 1 ROLLBACK TRANSACTION;                       -- আমার → পুরোটা
        ELSE IF XACT_STATE() = 1 ROLLBACK TRANSACTION @sp;          -- শুধু আমার অংশ
        THROW;
    END CATCH
END`,
      iq: { q: "BEGIN TRAN; BEGIN TRAN; COMMIT; — @@TRANCOUNT কত?", a: "<b>1</b> — আর কিছুই commit হয়নি। এখন ROLLBACK দিলে সব rollback, count 0। তাই নিজে শুরু করোনি এমন transaction কখনো অন্ধভাবে ROLLBACK কোরো না।" }
    }
  ],
  quiz: [
    { q: "BEGIN TRAN; BEGIN TRAN; COMMIT; পরে @@TRANCOUNT?", o: ["0", "1", "2", "Error"], a: 1, e: "ভিতরের COMMIT শুধু count কমায়।" },
    { q: "Doomed transaction-এ XACT_STATE()?", o: ["0", "1", "-1", "NULL"], a: 2, e: "শুধু rollback সম্ভব।" },
    { q: "Original error হুবহু আবার ছুঁড়তে?", o: ["RAISERROR", "bare THROW;", "PRINT", "RETURN"], a: 1, e: "Number, message, line সব থাকে।" }
  ],
  cards: [
    ["CATCH-এ কী চেক?", "XACT_STATE() <> 0 → ROLLBACK"],
    ["আংশিক rollback", "SAVE TRANSACTION @sp"],
    ["THROW vs RAISERROR", "THROW ব্যবহার করো; re-raise-এ bare THROW"]
  ]
},
{
  id: 19, part: 4, icon: "🧵",
  en: "Strings, Dates, JSON, and Pivoting", bn: "String, Date, JSON ও Pivot",
  pages: "57–58",
  sections: [
    {
      t: "STRING_AGG ও STRING_SPLIT",
      bn: "Row → এক লাইনে comma list (<b>STRING_AGG</b>), আর উল্টোটা (<b>STRING_SPLIT</b>)।",
      en: "Rows to a delimited list and back.",
      code: `-- একজন customer-এর সব account number এক লাইনে (2017+)
SELECT c.CustomerId, c.FullName,
       STRING_AGG(a.AccountNumber, ', ') WITHIN GROUP (ORDER BY a.OpenedOn) AS Accounts
FROM dbo.Customers AS c
JOIN dbo.Accounts  AS a ON a.CustomerId = c.CustomerId
GROUP BY c.CustomerId, c.FullName;

-- উল্টো: CSV parameter → set
SELECT TRIM(value) AS AccountNumber
FROM STRING_SPLIT(@CsvList, ',')
WHERE TRIM(value) <> '';

-- পুরনো code-এ দেখবে: FOR XML PATH('') + STUFF trick`,
      run: `SELECT c.CustomerId, c.FullName, GROUP_CONCAT(a.AccountNumber, ', ') AS Accounts
FROM Customers c JOIN Accounts a ON a.CustomerId = c.CustomerId
GROUP BY c.CustomerId, c.FullName;`,
      viz: "stringAgg"
    },
    {
      t: "Date সঠিকভাবে",
      bn: "DATEADD, DATEDIFF, EOMONTH, DATEFROMPARTS।",
      en: "Date functions.",
      code: `SELECT DATEADD(MONTH, 3, '2026-01-31')           AS ThreeMonthsOn, -- 2026-04-30
       DATEDIFF(DAY, '2026-01-01', '2026-07-16')  AS DaysBetween,
       EOMONTH('2026-02-01')                      AS LastDayOfFeb,
       DATEFROMPARTS(2026, 7, 16)                 AS Built,
       FORMAT(SYSUTCDATETIME(), 'yyyy-MM-dd')     AS Formatted;    -- slow: এড়াও`,
      run: `SELECT date('2026-01-31', '+3 months') AS ThreeMonthsOn_sqlite,
       julianday('2026-07-16') - julianday('2026-01-01') AS DaysBetween,
       date('2026-02-01', 'start of month', '+1 month', '-1 day') AS LastDayOfFeb;`,
      trap: { bn: "<code>DATEDIFF(YEAR, '2025-12-31', '2026-01-01')</code> = <b>1</b>! এটা সীমানা পার হওয়া গোনে, সময় না — অথচ ব্যবধান মাত্র ১ দিন। DATEDIFF(YEAR) দিয়ে বয়স = অর্ধেক মানুষের জন্য ভুল। আর FORMAT() ~৩০× slow।", en: "DATEDIFF counts boundary crossings." },
      viz: "datediff"
    },
    {
      t: "JSON",
      bn: "JSON_VALUE (scalar বের করো), OPENJSON (array → row), FOR JSON (query → JSON)।",
      en: "JSON_VALUE, OPENJSON, FOR JSON.",
      code: `-- JSON column থেকে scalar
SELECT t.TxnId,
       JSON_VALUE(t.Reference, '$.merchant') AS Merchant,
       JSON_VALUE(t.Reference, '$.deviceId') AS DeviceId
FROM dbo.Transactions AS t
WHERE ISJSON(t.Reference) = 1;

-- JSON array → rows
SELECT j.AccountId, j.Amount
FROM OPENJSON(@JsonPayload)
WITH (AccountId BIGINT        '$.accountId',
      Amount    DECIMAL(19,4) '$.amount') AS j;

-- API-র জন্য সরাসরি JSON
SELECT a.AccountNumber, a.Balance,
       (SELECT TOP (5) t.TxnDate, t.Amount
        FROM dbo.Transactions AS t
        WHERE t.AccountId = a.AccountId
        ORDER BY t.TxnDate DESC
        FOR JSON PATH) AS RecentTxns
FROM dbo.Accounts AS a
WHERE a.AccountId = @AccountId
FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;`,
      run: `SELECT json_extract('{"merchant":"Daraz","deviceId":"D-77"}', '$.merchant') AS Merchant;`,
      tip: { bn: "JSON = schema-র জরুরি দরজা, schema না। WHERE-এ JSON_VALUE দিয়ে filter করছ? ওটা কলাম হতে চায় (non-SARGable → scan)। না পারলে: persisted computed column + index।", en: "Filtering on JSON_VALUE? Make it a column." }
    },
    {
      t: "PIVOT — Row থেকে Column",
      bn: "Conditional aggregation (পরিষ্কার, portable) অথবা T-SQL-এর PIVOT operator।",
      en: "Rows to columns.",
      code: `-- Conditional aggregation দিয়ে (পছন্দনীয়)
SELECT a.BranchId,
  SUM(CASE WHEN MONTH(t.TxnDate) = 1 THEN t.Amount ELSE 0 END) AS Jan,
  SUM(CASE WHEN MONTH(t.TxnDate) = 2 THEN t.Amount ELSE 0 END) AS Feb,
  SUM(CASE WHEN MONTH(t.TxnDate) = 3 THEN t.Amount ELSE 0 END) AS Mar
FROM dbo.Transactions AS t
JOIN dbo.Accounts AS a ON a.AccountId = t.AccountId
WHERE t.TxnDate >= '2026-01-01' AND t.TxnDate < '2026-04-01'
GROUP BY a.BranchId;

-- PIVOT operator
SELECT BranchId, [SAVINGS], [CURRENT], [FD]
FROM (SELECT BranchId, AccountType, Balance FROM dbo.Accounts) AS src
PIVOT (SUM(Balance) FOR AccountType IN ([SAVINGS], [CURRENT], [FD])) AS p;`,
      run: `SELECT a.BranchId,
  SUM(CASE WHEN strftime('%m', t.TxnDate) = '01' THEN t.Amount ELSE 0 END) AS Jan,
  SUM(CASE WHEN strftime('%m', t.TxnDate) = '02' THEN t.Amount ELSE 0 END) AS Feb,
  SUM(CASE WHEN strftime('%m', t.TxnDate) = '03' THEN t.Amount ELSE 0 END) AS Mar
FROM Transactions t JOIN Accounts a ON a.AccountId = t.AccountId
WHERE t.TxnDate >= '2026-01-01' AND t.TxnDate < '2026-04-01'
GROUP BY a.BranchId;`,
      viz: "pivot",
      mem: "PIVOT-এ column value আগে থেকে জানতে হয়। Dynamic লাগলে → ভাবো presentation layer (Excel/report tool) এটা করবে কিনা। Database layout-এ খারাপ।"
    }
  ],
  quiz: [
    { q: "DATEDIFF(YEAR, '2025-12-31', '2026-01-01') = ?", o: ["0", "1", "0.003", "Error"], a: 1, e: "Boundary crossing গোনে।" },
    { q: "Rows → comma list (2017+)?", o: ["STRING_SPLIT", "STRING_AGG", "CONCAT", "PIVOT"], a: 1, e: "STRING_AGG(col, ', ')।" },
    { q: "FORMAT() সম্পর্কে?", o: ["দ্রুত", "~৩০× slow, বহু row-এ এড়াও", "Deprecated", "শুধু JSON-এ"], a: 1, e: "CLR function; CONVERT() ব্যবহার করো।" }
  ],
  cards: [
    ["DATEDIFF trap", "Elapsed time না, boundary crossing গোনে"],
    ["JSON filter slow?", "Persisted computed column + index"],
    ["PIVOT বিকল্প", "SUM(CASE WHEN ...) — portable"]
  ]
},
// ───────────────────────────── PART V ─────────────────────────────
{
  id: 20, part: 5, icon: "🌲",
  en: "Indexes", bn: "Index",
  pages: "60–63",
  sections: [
    {
      t: "Index = বইয়ের সূচিপত্র",
      bn: "Index হলো data-র একটা redundant, <b>sorted</b> কপি, নিজে নিজে maintain হয় — সব না পড়েই row খুঁজে দেয়। বাকি সব এর ফলাফল।",
      en: "An index is a redundant, sorted copy of some of your data.",
      mem: "📖 বইয়ের শেষে সূচিপত্র = index। পাতা উল্টে খোঁজা = table scan।"
    },
    {
      t: "B-Tree: Seek vs Scan 🌲",
      bn: "৬ কোটি row-এর Transactions-এর tree মাত্র ~৪ level গভীর → ১টা row খুঁজতে ~৪ page read, full scan-এ ৮ লাখ! ▶ চাপো।",
      en: "B+tree depth grows logarithmically: ~4 reads vs 800,000.",
      viz: "btree"
    },
    {
      t: "Plan Operator চিনে নাও",
      bn: "🎯 <b>Index Seek</b> — সরাসরি tree বেয়ে, O(log n)। এটাই চাও।<br>📜 <b>Index Scan</b> — index-এর সব leaf পড়া।<br>🐘 <b>Table/Clustered Scan</b> — সব row। ১০ row-এ ঠিক, ৬ কোটিতে বিপর্যয়।<br>🔁 <b>Key Lookup</b> — nonclustered index-এ পেলাম, কিন্তু বাকি কলামের জন্য clustered-এ ফিরে যাওয়া। প্রতি row-এ একবার।",
      en: "Seek, Scan, Table Scan, Key Lookup."
    },
    {
      t: "Clustered vs Nonclustered",
      bn: "<b>Clustered index = table নিজেই</b>, physical order ঠিক করে। প্রতি table-এ ১টা। Nonclustered = আলাদা structure, leaf-এ clustering key pointer হিসেবে।<br>ভালো clustering key: <b>সরু</b> (প্রতিটা NC index-এ কপি হয়), <b>unique</b>, <b>স্থির</b>, <b>ক্রমবর্ধমান</b>।",
      en: "Clustered = the table. Good key: narrow, unique, static, ever-increasing.",
      viz: "clusteredNC",
      trap: { bn: "Random GUID (NEWID()) clustering key = ক্লাসিক বিপর্যয়: ১৬ byte, এলোমেলো insert → প্রতিবার page split, fragmentation ৯৯%। লাগলে NEWSEQUENTIALID() বা IDENTITY-তে cluster + GUID-এ NC unique index।", en: "Random GUID clustering key = page splits." }
    },
    {
      t: "Composite Key: Order-ই সব 📞",
      bn: "Phone book (LastName, FirstName) দিয়ে সাজানো: 'Rahman, Karim' খোঁজা তাৎক্ষণিক। সব 'Karim' খোঁজা = পুরো বই পড়া। Index (A, B) কাজ করে A-তে, A+B-তে — <b>কখনো শুধু B-তে না</b>। নিচে চেষ্টা করো।",
      en: "An index on (A, B) serves A and A+B, never B alone.",
      code: `CREATE NONCLUSTERED INDEX IX_Txn_Account_Date
    ON dbo.Transactions (AccountId, TxnDate);

-- ⚡ SEEK: leading column আছে
SELECT * FROM dbo.Transactions WHERE AccountId = 1001;

-- ⚡ SEEK + range: দুটোই, key order-এ
SELECT * FROM dbo.Transactions
WHERE AccountId = 1001 AND TxnDate >= '2026-01-01';

-- 🐢 SCAN: leading column নেই
SELECT * FROM dbo.Transactions WHERE TxnDate >= '2026-01-01';`,
      viz: "compositeIndex",
      mem: "Column order নিয়ম: <b>Equality আগে → তারপর Range → তারপর ORDER BY কলাম</b>।"
    },
    {
      t: "Covering Index ও INCLUDE",
      bn: "Key Lookup = লুকানো খরচ (প্রতি row-এ random read)। ~১ লাখ lookup-এ optimizer হাল ছেড়ে পুরো table scan করে ('tipping point')। INCLUDE কলাম শুধু leaf-এ থাকে — tree চওড়া করে না।",
      en: "INCLUDE columns ride along in the leaf to eliminate key lookups.",
      code: `-- IX_Txn_Account_Date seek করে, তারপর প্রতি row-এ Key Lookup
SELECT TxnDate, Amount, TxnType, Channel
FROM dbo.Transactions
WHERE AccountId = 1001 AND TxnDate >= '2026-01-01';

-- Covering index: বাড়তি কলাম শুধু LEAF-এ
CREATE NONCLUSTERED INDEX IX_Txn_Account_Date_Covering
    ON dbo.Transactions (AccountId, TxnDate)    -- KEY: navigation
    INCLUDE (Amount, TxnType, Channel);         -- LEAF: lookup নেই`,
      viz: "keyLookup",
      tip: { bn: "সব কলাম INCLUDE কোরো না — অর্ধেক row include = table-এর দ্বিতীয় কপি, write খরচ দ্বিগুণ। Hot query-র যা লাগে শুধু তা।", en: "Cover what the hot query needs, not everything." }
    },
    {
      t: "Filtered Index",
      bn: "শুধু দরকারি row-এর index — ৪ লাখের মধ্যে ১২ হাজার DORMANT। আকারে ৩%, memory-তে থাকে। 'Unique কিন্তু অনেক NULL চলবে' trick-ও এটা।",
      en: "Index only the rows that matter.",
      code: `CREATE NONCLUSTERED INDEX IX_Accounts_Dormant
    ON dbo.Accounts (BranchId, ClosedOn)
    WHERE Status = 'DORMANT';

-- Unique, কিন্তু NULL অনেক থাকতে পারে
CREATE UNIQUE NONCLUSTERED INDEX UQ_Customers_Email
    ON dbo.Customers (Email) WHERE Email IS NOT NULL;`,
      trap: { bn: "Parameter <code>@Status = 'DORMANT'</code> filter মেলে না, যদি না OPTION (RECOMPILE) দাও।", en: "Parameterised predicates don't match filtered indexes." }
    },
    {
      t: "Index-এর খরচ 💸",
      bn: "প্রতিটা index = প্রতিটা write-এ রাখা প্রতিশ্রুতি। ১৫ index = ১ row insert-এ ১৬ write। Slider টানো।",
      en: "Each index is a promise kept on every write.",
      viz: "indexCost",
      iq: { q: "প্রতিটা কলামে index দাও না কেন?", a: "১৫ index = ১ insert-এ ১৬ write, log flood, writer block, useful page memory থেকে বের। Index = write speed দিয়ে read speed কেনা। OLTP table-এ সাধারণত ৫–৭টা ভালো index সর্বোচ্চ।" }
    },
    {
      t: "Missing ও Unused Index খোঁজা",
      bn: "DMV দিয়ে: optimizer যা চেয়েছিল (missing), আর যা শুধু write খরচ করছে কিন্তু কেউ পড়ে না (unused)।",
      en: "DMVs for missing and unused indexes.",
      code: `-- Optimizer যা চেয়েছিল (পরামর্শ, আদেশ না)
SELECT TOP (20)
  ROUND(s.avg_total_user_cost * s.avg_user_impact * (s.user_seeks + s.user_scans), 0) AS Score,
  d.statement AS TableName, d.equality_columns, d.inequality_columns, d.included_columns
FROM sys.dm_db_missing_index_group_stats AS s
JOIN sys.dm_db_missing_index_groups  AS g ON g.index_group_handle = s.group_handle
JOIN sys.dm_db_missing_index_details AS d ON d.index_handle = g.index_handle
ORDER BY Score DESC;

-- Write আছে, read নেই
SELECT OBJECT_NAME(i.object_id) AS TableName, i.name AS IndexName,
       u.user_seeks, u.user_scans, u.user_lookups, u.user_updates
FROM sys.indexes AS i
LEFT JOIN sys.dm_db_index_usage_stats AS u
       ON u.object_id = i.object_id AND u.index_id = i.index_id AND u.database_id = DB_ID()
WHERE i.type_desc = 'NONCLUSTERED' AND i.is_primary_key = 0
  AND ISNULL(u.user_seeks,0) + ISNULL(u.user_scans,0) + ISNULL(u.user_lookups,0) = 0
  AND ISNULL(u.user_updates,0) > 1000
ORDER BY u.user_updates DESC;`,
      trap: { bn: "Missing-index পরামর্শ অন্ধভাবে apply কোরো না — অন্য index জানে না, সব কলাম INCLUDE চায়, কখনো drop বলে না। সব apply = ২০টা overlapping index। প্রমাণ হিসেবে পড়ো, নিজে design করো।", en: "Never apply missing-index suggestions blindly." },
      tip: { bn: "PostgreSQL-এ clustered index নেই (heap); partial index = filtered, expression index, INCLUDE (v11+), GIN/GiST/BRIN। MySQL InnoDB সবসময় PK-তে cluster করে।", en: "Dialect notes." }
    }
  ],
  quiz: [
    { q: "Index (AccountId, TxnDate) কোন query-তে SEEK করবে না?", o: ["WHERE AccountId = 1", "WHERE AccountId = 1 AND TxnDate > X", "WHERE TxnDate > X", "WHERE AccountId IN (1,2)"], a: 2, e: "Leading column নেই।" },
    { q: "Key Lookup দূর করতে?", o: ["NOLOCK", "INCLUDE কলাম (covering index)", "Clustered index drop", "UNION"], a: 1, e: "বাড়তি কলাম leaf-এ।" },
    { q: "ভালো clustering key?", o: ["Random GUID", "সরু, unique, স্থির, ক্রমবর্ধমান", "চওড়া composite", "Nullable string"], a: 1, e: "IDENTITY আদর্শ।" },
    { q: "Composite index-এ কলামের order?", o: ["Alphabetical", "Equality → Range → ORDER BY", "Range আগে", "কোনো ব্যাপার না"], a: 1, e: "Phone book নিয়ম।" },
    { q: "Table-এ ১৫টা index থাকলে ১ INSERT = কয় write?", o: ["1", "15", "16", "30"], a: 2, e: "Table + ১৫ index।" }
  ],
  cards: [
    ["Index (A,B) কাজ করে", "A এবং A+B-তে; শুধু B-তে কখনো না"],
    ["Key Lookup", "NC index থেকে clustered-এ ফেরা; INCLUDE দিয়ে সারাও"],
    ["Clustering key", "Narrow · Unique · Static · Ever-increasing"],
    ["Filtered index", "WHERE সহ index — ছোট, দ্রুত"]
  ]
},
{
  id: 21, part: 5, icon: "📈",
  en: "Statistics and the Optimizer", bn: "Statistics ও Optimizer",
  pages: "64–65",
  sections: [
    {
      t: "Cardinality Estimation-ই আসল খেলা",
      bn: "Optimizer-এর কাজ = প্রতিটা operator কয় row দেবে <b>অনুমান</b> করা। ঠিক হলে ঠিক join, ঠিক index, ঠিক memory। ভুল হলে সব ভুল — ভুল গুণ হয়ে উপরে ওঠে। অনুমান আসে <b>statistics</b> থেকে: ২০০ ধাপের histogram + density vector।",
      en: "Cardinality estimation drives every plan decision. Statistics = 200-step histogram + density.",
      code: `DBCC SHOW_STATISTICS ('dbo.Transactions', 'IX_Txn_Account_Date') WITH HISTOGRAM;

-- Stats কবে update হয়েছে, কতটা পুরনো?
SELECT s.name AS StatName, sp.last_updated, sp.rows, sp.rows_sampled,
       sp.modification_counter
FROM sys.stats AS s
CROSS APPLY sys.dm_db_stats_properties(s.object_id, s.stats_id) AS sp
WHERE s.object_id = OBJECT_ID('dbo.Transactions');`,
      viz: "histogram"
    },
    {
      t: "Statistics যখন বাসি হয়",
      bn: "Auto-update চলে ≈ <b>√(1000 × n)</b> row বদলালে। ৬ কোটি row-এ ≈ ২,৪৫,০০০ পরিবর্তন।<br><b>Ascending key সমস্যা:</b> TxnDate সবসময় 'এখন'। গতকালের histogram গতকালেই শেষ → আজকের data-র জন্য ১ row অনুমান → nested loops → ৪ লাখ row আসে → ১ ঘণ্টা।",
      en: "Ascending key problem: the histogram ends yesterday, today estimates 1 row.",
      code: `-- আজকের data → estimate ১ row, আসলে ৪ লাখ
SELECT * FROM dbo.Transactions WHERE TxnDate >= CAST(GETDATE() AS DATE);

-- সমাধান:
UPDATE STATISTICS dbo.Transactions IX_Txn_Account_Date WITH FULLSCAN;`,
      mem: "Actual plan-এ <b>Estimated vs Actual rows</b> = tuning-এর সবচেয়ে মূল্যবান সংখ্যা। ১০×-এর বেশি পার্থক্য? আর কিছু দেখো না — আগে estimate ঠিক করো।"
    },
    {
      t: "Estimate কোথায় ভুল হয়",
      bn: "নিচের কার্ডে ক্লিক করে সমাধান দেখো।",
      en: "Where estimates go wrong.",
      viz: "estimateWrong"
    }
  ],
  quiz: [
    { q: "Plan debug-এ সবচেয়ে মূল্যবান সংখ্যা?", o: ["Cost %", "Estimated vs Actual rows", "Query length", "Index count"], a: 1, e: "১০×-এর বেশি skew → আগে ওটা ঠিক করো।" },
    { q: "Table variable-এর estimate?", o: ["Exact", "১ row", "১০%", "৩০%"], a: 1, e: "#temp ব্যবহার করো।" },
    { q: "WHERE YEAR(TxnDate) = 2026 — estimate সমস্যা কেন?", o: ["YEAR slow", "YEAR(TxnDate)-এর histogram নেই", "Syntax", "Index নেই"], a: 1, e: "Optimizer অনুমান করে।" }
  ],
  cards: [
    ["Statistics", "২০০-ধাপ histogram + density vector"],
    ["Ascending key", "আজকের data-র estimate ১ row → UPDATE STATISTICS"]
  ]
},
{
  id: 22, part: 5, icon: "🔬",
  en: "Execution Plans, SARGability, and Parameter Sniffing", bn: "Execution Plan, SARGability ও Parameter Sniffing",
  pages: "66–69",
  sections: [
    {
      t: "Plan পড়া",
      bn: "<b>ডান থেকে বামে, উপর থেকে নিচে</b> পড়ো — data সেভাবে প্রবাহিত হয়। ক্রমানুসারে দেখো:<br>① Estimated vs actual rows ② মোটা তীর (আগেভাগে অনেক data) ③ Seek-এর জায়গায় Scan ④ বেশি row-এ Key Lookup ⑤ Sort operator ⑥ tempdb spill (⚠️ ত্রিভুজ) ⑦ Implicit conversion warning",
      en: "Read plans right to left. Check estimated vs actual first.",
      code: `SET STATISTICS IO, TIME ON;    -- logical reads, CPU/elapsed
GO
-- SSMS-এ Ctrl+M = ACTUAL plan
SELECT ...
GO
SET STATISTICS IO, TIME OFF;`,
      viz: "planReader",
      tip: { bn: "Operator cost % উপেক্ষা করো! ওগুলো একই ভুল estimate থেকে আসে — ১ row অনুমান করা scan ০% দেখায় অথচ ৯০% সময় খায়। STATISTICS IO-এর logical reads বিশ্বাস করো।", en: "Ignore cost percentages." }
    },
    {
      t: "SARGability ⭐ — এক বাক্যের নিয়ম",
      bn: "<b>Column operator-এর এক পাশে একা থাকবে।</b> Column-কে function-এ মুড়লে, অঙ্ক করলে বা type বদলালে → index raw column দিয়ে সাজানো, তোমার expression দিয়ে না → প্রতি row-এ হিসাব → SCAN।",
      en: "The column must appear alone on one side of the operator.",
      mem: "🧍 Column-কে <b>একা</b> থাকতে দাও। সব হিসাব অন্য পাশে।"
    },
    {
      t: "SARGable Quiz 🎮 — Scan না Seek?",
      bn: "প্রতিটা predicate দেখে বলো SEEK ⚡ নাকি SCAN 🐢।",
      en: "Six non-SARGable predicates and their rewrites.",
      viz: "sargGame",
      code: `-- 1. Column-এ function
WHERE YEAR(TxnDate) = 2026                                   -- SCAN
WHERE TxnDate >= '2026-01-01' AND TxnDate < '2027-01-01'     -- SEEK

-- 2. Column-এ অঙ্ক
WHERE Balance * 1.05 > 100000                                -- SCAN
WHERE Balance > 100000 / 1.05                                -- SEEK

-- 3. Time কাটতে function
WHERE CAST(TxnDate AS DATE) = '2026-07-16'                   -- SCAN*
WHERE TxnDate >= '2026-07-16' AND TxnDate < '2026-07-17'     -- SEEK

-- 4. শুরুতে wildcard
WHERE FullName LIKE '%Rahman'                                -- SCAN
WHERE FullName LIKE 'Rahman%'                                -- SEEK

-- 5. Implicit conversion (AccountNumber CHAR(13))
WHERE AccountNumber = N'1001000000001'                       -- SCAN
WHERE AccountNumber =  '1001000000001'                       -- SEEK

-- 6. Column-এ ISNULL
WHERE ISNULL(ClosedOn, '9999-12-31') > GETDATE()             -- SCAN
WHERE ClosedOn > GETDATE() OR ClosedOn IS NULL               -- SEEK`
    },
    {
      t: "Expression-এ Index",
      bn: "Legacy app <code>WHERE UPPER(Email) = @x</code> পাঠায় আর বদলানো যায় না? Persisted computed column + index → optimizer নিজেই মিলিয়ে নেয়।",
      en: "Persisted computed column + index.",
      code: `ALTER TABLE dbo.Customers ADD EmailUpper AS UPPER(Email) PERSISTED;
CREATE INDEX IX_Customers_EmailUpper ON dbo.Customers(EmailUpper);
-- Optimizer মূল expression মিলিয়ে index seek করে
-- PostgreSQL: CREATE INDEX ON Customers (UPPER(Email));`
    },
    {
      t: "Parameter Sniffing 👃",
      bn: "প্রথমবার চালানোর সময় SQL Server parameter value 'শুঁকে' সেই value-র জন্য optimal plan বানায় ও cache করে। পরের সব call সেই plan ব্যবহার করে — value যতই আলাদা হোক। নিচে কোন city আগে চলবে বেছে নাও।",
      en: "The first call's parameters decide the cached plan for everyone.",
      code: `CREATE OR ALTER PROCEDURE dbo.usp_AccountsByCity @City NVARCHAR(60)
AS
SELECT a.AccountId, a.Balance
FROM dbo.Accounts  AS a
JOIN dbo.Customers AS c ON c.CustomerId = a.CustomerId
WHERE c.City = @City;
GO
EXEC dbo.usp_AccountsByCity N'Sylhet';  -- ৩০০ row: nested loops। আদর্শ।
-- Plan এখন cached।
EXEC dbo.usp_AccountsByCity N'Dhaka';   -- ১,৮০,০০০ row: ১,৮০,০০০ key lookup!`,
      viz: "sniffing",
      iq: { q: "এক বছর ঠিক চলেছে, আজ সকালে ১০০× slow। Code/data বদলায়নি। কী হলো?", a: "Plan cache flush হয়েছে (restart, failover, memory pressure, stats update) → প্রথমে যে atypical parameter এসেছে তার plan cache হয়েছে। ক্লাসিক <b>parameter sniffing</b>। তাৎক্ষণিক: <code>sp_recompile</code> বা Query Store থেকে ভালো plan force।" }
    },
    {
      t: "Query Store — Flight Recorder ✈️",
      bn: "কোন query deploy-এর পর regress করেছে দেখো, আর ভালো plan pin করো — code না বদলিয়ে।",
      en: "Find regressions and force a known-good plan.",
      code: `ALTER DATABASE BankDB SET QUERY_STORE = ON
    (OPERATION_MODE = READ_WRITE, QUERY_CAPTURE_MODE = AUTO);

SELECT TOP (20) q.query_id, t.query_sql_text,
       rs.avg_duration / 1000.0 AS AvgMs,
       rs.avg_logical_io_reads, rs.count_executions, p.plan_id
FROM sys.query_store_query         AS q
JOIN sys.query_store_query_text    AS t  ON t.query_text_id = q.query_text_id
JOIN sys.query_store_plan          AS p  ON p.query_id = q.query_id
JOIN sys.query_store_runtime_stats AS rs ON rs.plan_id = p.plan_id
ORDER BY rs.avg_duration DESC;

-- ভালো plan pin করো
EXEC sys.sp_query_store_force_plan @query_id = 42, @plan_id = 17;`,
      tip: { bn: "PostgreSQL: <code>EXPLAIN (ANALYZE, BUFFERS)</code> = actual plan; pg_stat_statements = Query Store-এর মতো। MySQL: EXPLAIN ANALYZE (8.0.18+)।", en: "Postgres EXPLAIN ANALYZE." }
    }
  ],
  quiz: [
    { q: "Plan কোন দিক থেকে পড়ো?", o: ["বাম থেকে ডানে", "ডান থেকে বামে", "নিচ থেকে উপরে", "যেকোনো"], a: 1, e: "Data flow ডান → বাম।" },
    { q: "কোনটা SARGable?", o: ["WHERE YEAR(d) = 2026", "WHERE Balance * 1.05 > X", "WHERE FullName LIKE 'Rah%'", "WHERE ISNULL(c, 0) = 1"], a: 2, e: "Column একা, শুরু জানা।" },
    { q: "Parameter sniffing-এর production firefighting টুল?", o: ["NOLOCK", "Query Store forced plan", "DROP INDEX", "Restart"], a: 1, e: "Code না বদলিয়ে ভালো plan pin।" },
    { q: "Operator cost % বিশ্বাস করবে?", o: ["হ্যাঁ", "না — ভুল estimate থেকে আসে", "শুধু Scan-এ", "শুধু Sort-এ"], a: 1, e: "Logical reads আর actual rows দেখো।" }
  ],
  cards: [
    ["SARGable নিয়ম", "Column operator-এর এক পাশে একা"],
    ["Parameter sniffing fix", "RECOMPILE · OPTIMIZE FOR · Query Store force plan"],
    ["Plan পড়ার দিক", "ডান → বাম, উপর → নিচ"]
  ]
},
{
  id: 23, part: 5, icon: "🩺",
  en: "Optimization Case Studies", bn: "Optimization Case Study",
  pages: "70–72",
  sections: [
    {
      t: "৬টা বাস্তব রোগ 🩺",
      bn: "প্রতিটা case: লক্ষণ → রোগ নির্ণয় → সমাধান → শিক্ষা। কার্ডে ক্লিক করো।",
      en: "Six real problems: symptom, diagnosis, fix, lesson.",
      viz: "caseStudies"
    },
    {
      t: "Case 1: Date function scan (৪ মিনিট → ২ সেকেন্ড)",
      bn: "YEAR()/MONTH() column মুড়েছে → ৬ কোটি row পড়ে ৫৯.৯৬ কোটি ফেলে দেয়। ৮,১২,০০০ reads → ১,৯০০।",
      en: "812,000 reads → 1,900 by removing a function on the column.",
      code: `-- ❌ আগে
WHERE YEAR(t.TxnDate) = 2026 AND MONTH(t.TxnDate) = 7

-- ✅ পরে
CREATE NONCLUSTERED INDEX IX_Txn_Date_Account
    ON dbo.Transactions (TxnDate) INCLUDE (AccountId, Amount);

SELECT a.BranchId, COUNT(*) AS Txns, SUM(t.Amount) AS Total
FROM dbo.Transactions AS t
JOIN dbo.Accounts AS a ON a.AccountId = t.AccountId
WHERE t.TxnDate >= '2026-07-01' AND t.TxnDate < '2026-08-01'
GROUP BY a.BranchId;`
    },
    {
      t: "Case 2: SELECT list-এ correlated subquery (৯০ → ৩ সেকেন্ড)",
      bn: "৩টা correlated subquery × ২.৫ লাখ customer = ৭.৫ লাখ execution। সমাধান: একবার aggregate করে set বানাও, তারপর set join করো। COALESCE খেয়াল করো — correlated COUNT(*) 0 দিত, LEFT JOIN দেয় NULL!",
      en: "Aggregate once into sets, then join sets. Watch the NULL vs 0 change.",
      code: `WITH AccountAgg AS (
    SELECT a.CustomerId, COUNT(*) AS AccountCount, SUM(a.Balance) AS TotalBalance
    FROM dbo.Accounts AS a GROUP BY a.CustomerId
),
LastTxn AS (
    SELECT a.CustomerId, MAX(t.TxnDate) AS LastTxnDate
    FROM dbo.Transactions AS t
    JOIN dbo.Accounts AS a ON a.AccountId = t.AccountId
    GROUP BY a.CustomerId
)
SELECT c.CustomerId, c.FullName,
       COALESCE(ag.AccountCount, 0) AS AccountCount,
       COALESCE(ag.TotalBalance, 0) AS TotalBalance,
       lt.LastTxnDate
FROM dbo.Customers AS c
LEFT JOIN AccountAgg AS ag ON ag.CustomerId = c.CustomerId
LEFT JOIN LastTxn    AS lt ON lt.CustomerId = c.CustomerId;`,
      run: `WITH AccountAgg AS (
  SELECT CustomerId, COUNT(*) AS AccountCount, SUM(Balance) AS TotalBalance FROM Accounts GROUP BY CustomerId),
LastTxn AS (
  SELECT a.CustomerId, MAX(t.TxnDate) AS LastTxnDate FROM Transactions t JOIN Accounts a ON a.AccountId = t.AccountId GROUP BY a.CustomerId)
SELECT c.CustomerId, c.FullName, COALESCE(ag.AccountCount,0) AS AccountCount,
       COALESCE(ag.TotalBalance,0) AS TotalBalance, lt.LastTxnDate
FROM Customers c LEFT JOIN AccountAgg ag ON ag.CustomerId = c.CustomerId
LEFT JOIN LastTxn lt ON lt.CustomerId = c.CustomerId;`
    },
    {
      t: "Case 3: Implicit conversion (৮০০ms → ১ms)",
      bn: "C#-এর <code>AddWithValue</code> NVARCHAR ধরে নেয়, অথচ NationalId VARCHAR(20) → প্রতি row-এ column convert → scan। SQL ছোঁয়াই লাগেনি!",
      en: "AddWithValue infers NVARCHAR. Specify the exact type.",
      code: `// ❌ আগে — NVARCHAR ধরে, index মারে
cmd.Parameters.AddWithValue("@nid", nid);

// ✅ পরে — column-এর type হুবহু
cmd.Parameters.Add("@nid", SqlDbType.VarChar, 20).Value = nid;`
    },
    {
      t: "Tuning পদ্ধতি — ৭ ধাপ 🧭",
      bn: "① <b>মাপো</b> — আসল slow query খোঁজো, অনুমান না।<br>② <b>Actual plan</b> নাও + STATISTICS IO, TIME।<br>③ <b>Estimated vs actual</b> তুলনা — আলাদা হলে আগে estimate ঠিক।<br>④ <b>বড় তিন</b> খোঁজো: column-এ function, missing/wrong index, row-by-row।<br>⑤ <b>একটা জিনিস বদলাও</b>, আবার মাপো।<br>⑥ <b>সঠিকতা যাচাই</b> — দুই দিকে EXCEPT।<br>⑦ <b>কেন লিখে রাখো</b>।",
      en: "Measure → actual plan → est vs actual → big three → change one thing → verify → document.",
      viz: "tuningSteps",
      mem: "সব query fast অথচ endpoint slow? → <b>Query গোনো</b> (N+1)। Index দিয়ে app-এর loop সারানো যায় না।"
    }
  ],
  quiz: [
    { q: "সব query 0.4ms, endpoint 6 সেকেন্ড। কী?", o: ["Missing index", "N+1 — অনেক বেশি query", "Deadlock", "Stale stats"], a: 1, e: "Statement গোনো।" },
    { q: "Page 4000-এ OFFSET 12 সেকেন্ড — সমাধান?", o: ["বড় server", "Keyset pagination", "NOLOCK", "আরও index"], a: 1, e: "আর হয়তো একটা export বাটন।" },
    { q: "Insert throughput ৪০k → ৬e, read ঠিক আছে। কারণ?", o: ["Over-indexed table", "Deadlock", "Parameter sniffing", "NULL"], a: 0, e: "১৪টা index, ৯টা কেউ পড়ে না।" },
    { q: "Rewrite-এর পর সঠিকতা যাচাই?", o: ["চোখে দেখা", "EXCEPT দুই দিকে", "COUNT(*) তুলনা", "দরকার নেই"], a: 1, e: "০ row = হুবহু এক।" }
  ],
  cards: [
    ["Tuning-এর প্রথম ধাপ", "মাপো — অনুমান কোরো না"],
    ["বড় তিন", "Column-এ function · Missing index · RBAR"],
    ["AddWithValue", "Type ভুল ধরে → implicit conversion"]
  ]
},
// ───────────────────────────── PART VI ─────────────────────────────
{
  id: 24, part: 6, icon: "📐",
  en: "Normalization and Anti-Patterns", bn: "Normalization ও Anti-Pattern",
  pages: "74–76",
  sections: [
    {
      t: "Normal Form — সহজ ভাষায়",
      bn: "<b>1NF</b> — প্রতি কলামে একটা atomic value। 'acc1,acc2' না, Phone1/Phone2/Phone3 না।<br><b>2NF</b> — 1NF + প্রতিটা non-key কলাম <b>পুরো</b> key-র উপর নির্ভর (composite key-তে প্রাসঙ্গিক)।<br><b>3NF</b> — 2NF + non-key কলাম অন্য non-key-র উপর নির্ভর না। Accounts-এ BranchCity রাখা = 3NF ভাঙা (city BranchId-এর উপর নির্ভর)।<br><b>BCNF</b> — কঠোর 3NF।",
      en: "1NF atomic, 2NF whole key, 3NF nothing but the key.",
      viz: "normalForms",
      mem: "⚖️ \"The key, the whole key, and nothing but the key — so help me Codd.\" OLTP-তে 3NF default।"
    },
    {
      t: "Denormalize — ইচ্ছাকৃতভাবে, নয়তো না",
      bn: "Accounts.Balance = SUM(Transactions)-এর কপি — বৈধ, কারণ প্রতি ATM query-তে ৬ কোটি row যোগ করা অসম্ভব। কিন্তু দাম পুরো দিতে হবে:<br>• প্রতিটা write path একই transaction-এ update করবে।<br>• Reconciliation job drift খুঁজবে (drift হবেই)।<br>• Row-টা concurrency hotspot হবে।",
      en: "Denormalization needs a maintaining transaction and reconciliation.",
      trap: { bn: "Maintaining transaction + reconciliation ছাড়া denormalization = <b>data corruption-এর সময়সূচি</b>। Test-এ ধরা পড়বে না, auditor-এর report-এ পড়বে।", en: "Without reconciliation it's a corruption schedule." }
    },
    {
      t: "Anti-Pattern ক্যাটালগ 🚫",
      bn: "প্রতিটা কার্ড উল্টে দেখো সমস্যা আর সমাধান।",
      en: "EAV, CSV in a column, polymorphic associations, god table, FLOAT money, no FKs.",
      viz: "antiPatterns",
      code: `-- EAV: "পুরো flexible! কখনো migration লাগবে না!"
CREATE TABLE CustomerAttributes (
    CustomerId INT, AttributeName VARCHAR(50), AttributeValue VARCHAR(500)
);
-- এখন: type নেই, constraint নেই, FK নেই, কাজের index নেই।
-- "Dhaka-র verified KYC customer" = প্রতি attribute-এ self-join।`
    },
    {
      t: "৮টা বাস্তব Design নিয়ম ✅",
      bn: "① প্রতিটা table-এ Primary Key। ব্যতিক্রম নেই।<br>② সম্পর্ক = Foreign Key, সবসময়।<br>③ আগে 3NF; প্রমাণ নিয়ে পরে denormalize।<br>④ যা সত্য হতেই হবে তা constrain করো (CHECK, UNIQUE, NOT NULL)।<br>⑤ নামকরণে ধারাবাহিকতা: Customers, CustomerId, FK_Accounts_Customers।<br>⑥ Timestamp UTC-তে রাখো; edge-এ convert।<br>⑦ Soft delete (IsDeleted) প্রতিটা query-তে predicate ঢোকায় যা সবাই ভুলবে → archive table/filtered index।<br>⑧ Write path সঠিকতার জন্য, read path গতির জন্য design করো।",
      en: "PKs, FKs, 3NF first, constraints, naming, UTC, avoid soft deletes, separate read/write design.",
      iq: { q: "কখন denormalize করবে?", a: "ভালো উত্তর: নির্দিষ্ট read path যা normalized অবস্থায় SLA মেটাতে পারে না, read/write ratio মাপা, আর কীভাবে duplicate maintain ও reconcile হবে। দুর্বল উত্তর: 'performance-এর জন্য'।" }
    }
  ],
  quiz: [
    { q: "Accounts table-এ BranchCity রাখলে কোন NF ভাঙে?", o: ["1NF", "2NF", "3NF", "কোনোটা না"], a: 2, e: "City BranchId-এর উপর নির্ভর, AccountId না।" },
    { q: "AccountIds = '1001,1002,1003' কোন NF ভাঙে?", o: ["1NF", "3NF", "BCNF", "কোনোটা না"], a: 0, e: "Atomic না। এটা junction table।" },
    { q: "Polymorphic association (OwnerId + OwnerType) সমাধান?", o: ["এভাবেই রাখো", "দুটো nullable FK + CHECK একটাই populated", "EAV", "JSON"], a: 1, e: "FK enforce করা যায়।" },
    { q: "'Performance-এর জন্য FK নেই' — সঠিক?", o: ["হ্যাঁ, বড় লাভ", "না — লাভ নগণ্য, orphan row ও optimizer তথ্য হারায়", "শুধু OLAP-এ", "শুধু MySQL-এ"], a: 1, e: "FK = কখনো পুরনো না হওয়া documentation।" }
  ],
  cards: [
    ["3NF মন্ত্র", "The key, the whole key, nothing but the key"],
    ["EAV", "এড়াও; দরকারে JSON column + computed index"],
    ["Soft delete", "Archive table বা filtered index ভালো"]
  ]
},
{
  id: 25, part: 6, icon: "🎯",
  en: "Interview Preparation and Exercises", bn: "ইন্টারভিউ প্রস্তুতি ও অনুশীলন",
  pages: "77–81",
  sections: [
    {
      t: "ইন্টারভিউ প্রশ্ন — Flip করে উত্তর দেখো 🃏",
      bn: "প্রথমে নিজে উত্তর ভাবো, তারপর কার্ড উল্টাও।",
      en: "The questions, and what they are really testing.",
      viz: "interviewCards"
    },
    {
      t: "দ্বিতীয় সর্বোচ্চ Balance",
      bn: "DENSE_RANK কেন, RANK না? প্রথম স্থানে tie হলে RANK-এ '2' কেউ থাকে না → ফাঁকা ফল।",
      en: "Second highest — use DENSE_RANK.",
      code: `-- পছন্দনীয়: tie ঠিকভাবে সামলায়
SELECT MAX(Balance) FROM dbo.Accounts
WHERE Balance < (SELECT MAX(Balance) FROM dbo.Accounts);

-- N-তম পর্যন্ত সাধারণীকরণ
SELECT Balance FROM (
    SELECT Balance, DENSE_RANK() OVER (ORDER BY Balance DESC) AS rnk
    FROM dbo.Accounts
) AS x WHERE rnk = 2;`,
      run: `SELECT DISTINCT Balance FROM (
  SELECT Balance, DENSE_RANK() OVER (ORDER BY Balance DESC) AS rnk FROM Accounts
) AS x WHERE rnk = 2;`
    },
    {
      t: "Duplicate খুঁজে পুরনোটা রেখে বাকি মোছো",
      bn: "GROUP BY ... HAVING COUNT(*) > 1 খুঁজে পায়; কিন্তু ঠিক একটা রাখতে শুধু ROW_NUMBER।",
      en: "ROW_NUMBER lets you keep exactly one deterministically.",
      code: `WITH d AS (
    SELECT CustomerId,
           ROW_NUMBER() OVER (PARTITION BY NationalId ORDER BY CreatedAt) AS rn
    FROM dbo.Customers
)
DELETE FROM d WHERE rn > 1;`
    },
    {
      t: "Exercise 1: প্রতি branch-এ active account (শূন্য সহ)",
      bn: "দুই ফাঁদ একসাথে: COUNT(*) খালি branch-এ 1 দেয় (NULL-padded row-ও row!), আর Status শর্ত WHERE-এ দিলে INNER JOIN হয়ে খালি branch বাদ।",
      en: "COUNT(col) + filter in ON.",
      code: `SELECT b.BranchName,
       COUNT(a.AccountId) AS ActiveAccounts     -- COUNT(col) NULL উপেক্ষা করে
FROM dbo.Branches AS b
LEFT JOIN dbo.Accounts AS a
       ON a.BranchId = b.BranchId AND a.Status = 'ACTIVE'   -- ON-এ filter!
GROUP BY b.BranchName
ORDER BY ActiveAccounts DESC;`,
      run: `SELECT b.BranchName, COUNT(a.AccountId) AS ActiveAccounts, COUNT(*) AS WrongCountStar
FROM Branches b
LEFT JOIN Accounts a ON a.BranchId = b.BranchId AND a.Status = 'ACTIVE'
GROUP BY b.BranchName ORDER BY ActiveAccounts DESC;`
    },
    {
      t: "Exercise 2: Customer-এর total balance ও rank",
      bn: "Window function GROUP BY-এর পরে চলে (ধাপ ৫ vs ৩), তাই aggregate-কে সরাসরি rank করা যায় — CTE লাগে না।",
      en: "Rank an aggregate directly.",
      code: `SELECT c.CustomerId, c.FullName,
       COALESCE(SUM(a.Balance), 0) AS TotalBalance,
       DENSE_RANK() OVER (ORDER BY COALESCE(SUM(a.Balance), 0) DESC) AS Rank
FROM dbo.Customers AS c
LEFT JOIN dbo.Accounts AS a ON a.CustomerId = c.CustomerId
GROUP BY c.CustomerId, c.FullName;`,
      run: `SELECT c.CustomerId, c.FullName,
       COALESCE(SUM(a.Balance), 0) AS TotalBalance,
       DENSE_RANK() OVER (ORDER BY COALESCE(SUM(a.Balance), 0) DESC) AS Rnk
FROM Customers c LEFT JOIN Accounts a ON a.CustomerId = c.CustomerId
GROUP BY c.CustomerId, c.FullName;`
    },
    {
      t: "Exercise 3: Velocity check — ২৪ ঘণ্টায় ৫+ debit",
      bn: "Standard/Postgres-এ <code>RANGE ... INTERVAL</code> frame আছে; SQL Server-এ নেই → APPLY। Interview-এ এটা জোরে বলো।",
      en: "SQL Server lacks INTERVAL frames — use APPLY.",
      code: `SELECT DISTINCT t1.AccountId
FROM dbo.Transactions AS t1
CROSS APPLY (
    SELECT COUNT(*) AS Cnt
    FROM dbo.Transactions AS t2
    WHERE t2.AccountId = t1.AccountId
      AND t2.TxnType   = 'DEBIT'
      AND t2.TxnDate   >  DATEADD(HOUR, -24, t1.TxnDate)
      AND t2.TxnDate   <= t1.TxnDate
) AS w
WHERE t1.TxnType = 'DEBIT' AND w.Cnt >= 5;`,
      run: `SELECT DISTINCT t1.AccountId,
  (SELECT COUNT(*) FROM Transactions t2
   WHERE t2.AccountId = t1.AccountId AND t2.TxnType = 'DEBIT'
     AND t2.TxnDate > datetime(t1.TxnDate, '-24 hours') AND t2.TxnDate <= t1.TxnDate) AS Cnt
FROM Transactions t1 WHERE t1.TxnType = 'DEBIT' ORDER BY Cnt DESC LIMIT 5;`
    },
    {
      t: "Exercise 4: Running balance",
      bn: "ROWS (default RANGE না), আর window-এর ORDER BY-তে TxnId tiebreaker — একই millisecond-এ দুই transaction হলে RANGE-এ দুজনেই একই total পেত।",
      en: "ROWS + TxnId tiebreaker.",
      code: `SELECT t.AccountId, t.TxnDate, t.Amount,
       SUM(CASE WHEN t.TxnType = 'CREDIT' THEN t.Amount ELSE -t.Amount END)
         OVER (PARTITION BY t.AccountId ORDER BY t.TxnDate, t.TxnId
               ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS RunningBalance
FROM dbo.Transactions AS t
WHERE t.TxnDate >= DATEADD(DAY, -30, GETDATE());`,
      run: `SELECT AccountId, TxnDate, TxnType, Amount,
  SUM(CASE WHEN TxnType = 'CREDIT' THEN Amount ELSE -Amount END)
    OVER (PARTITION BY AccountId ORDER BY TxnDate, TxnId
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS RunningBalance
FROM Transactions WHERE AccountId = 1;`
    },
    {
      t: "Exercise 5: Account আছে কিন্তু কখনো transaction নেই",
      bn: "EXISTS + NOT EXISTS একসাথে।",
      en: "EXISTS and NOT EXISTS together.",
      code: `SELECT c.CustomerId, c.FullName
FROM dbo.Customers AS c
WHERE EXISTS (SELECT 1 FROM dbo.Accounts AS a WHERE a.CustomerId = c.CustomerId)
  AND NOT EXISTS (
      SELECT 1 FROM dbo.Accounts AS a
      JOIN dbo.Transactions AS t ON t.AccountId = a.AccountId
      WHERE a.CustomerId = c.CustomerId);`,
      run: `SELECT c.CustomerId, c.FullName FROM Customers c
WHERE EXISTS (SELECT 1 FROM Accounts a WHERE a.CustomerId = c.CustomerId)
  AND NOT EXISTS (SELECT 1 FROM Accounts a JOIN Transactions t ON t.AccountId = a.AccountId
                  WHERE a.CustomerId = c.CustomerId);`
    },
    {
      t: "Exercise 7: প্রতি account-এর দীর্ঘতম streak",
      bn: "Gaps & islands + ROW_NUMBER দিয়ে সবচেয়ে লম্বাটা বাছাই।",
      en: "Longest activity streak per account.",
      code: `WITH Daily AS (
    SELECT DISTINCT AccountId, CAST(TxnDate AS DATE) AS D FROM dbo.Transactions
),
Islands AS (
    SELECT AccountId, D,
           DATEADD(DAY, -ROW_NUMBER() OVER (PARTITION BY AccountId ORDER BY D), D) AS grp
    FROM Daily
),
Streaks AS (
    SELECT AccountId, COUNT(*) AS Len, MIN(D) AS StartD, MAX(D) AS EndD
    FROM Islands GROUP BY AccountId, grp
)
SELECT AccountId, Len, StartD, EndD
FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY AccountId
                                   ORDER BY Len DESC, StartD) AS rn
      FROM Streaks) AS x
WHERE rn = 1;`,
      run: `WITH Daily AS (SELECT DISTINCT AccountId, date(TxnDate) AS D FROM Transactions),
Islands AS (SELECT AccountId, D, date(D, '-' || ROW_NUMBER() OVER (PARTITION BY AccountId ORDER BY D) || ' days') AS grp FROM Daily),
Streaks AS (SELECT AccountId, COUNT(*) AS Len, MIN(D) AS StartD, MAX(D) AS EndD FROM Islands GROUP BY AccountId, grp)
SELECT AccountId, Len, StartD, EndD FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY AccountId ORDER BY Len DESC, StartD) AS rn FROM Streaks) x
WHERE rn = 1;`
    },
    {
      t: "Exercise 8: Month-over-month growth",
      bn: "LAG + NULLIF — প্রথম মাসে আগের value নেই, আর কোনো মাস ০ হলে divide-by-zero পুরো report মেরে ফেলত।",
      en: "LAG for previous month, NULLIF to guard division.",
      code: `WITH Monthly AS (
    SELECT a.BranchId,
           DATEFROMPARTS(YEAR(t.TxnDate), MONTH(t.TxnDate), 1) AS Mth,
           SUM(t.Amount) AS Total
    FROM dbo.Transactions AS t
    JOIN dbo.Accounts AS a ON a.AccountId = t.AccountId
    GROUP BY a.BranchId, DATEFROMPARTS(YEAR(t.TxnDate), MONTH(t.TxnDate), 1)
)
SELECT BranchId, Mth, Total,
       LAG(Total) OVER (PARTITION BY BranchId ORDER BY Mth) AS PrevTotal,
       100.0 * (Total - LAG(Total) OVER (PARTITION BY BranchId ORDER BY Mth))
             / NULLIF(LAG(Total) OVER (PARTITION BY BranchId ORDER BY Mth), 0) AS GrowthPct
FROM Monthly
ORDER BY BranchId, Mth;`,
      run: `WITH Monthly AS (
  SELECT a.BranchId, substr(t.TxnDate,1,7) AS Mth, SUM(t.Amount) AS Total
  FROM Transactions t JOIN Accounts a ON a.AccountId = t.AccountId
  GROUP BY a.BranchId, substr(t.TxnDate,1,7))
SELECT BranchId, Mth, Total,
  LAG(Total) OVER (PARTITION BY BranchId ORDER BY Mth) AS PrevTotal,
  ROUND(100.0 * (Total - LAG(Total) OVER (PARTITION BY BranchId ORDER BY Mth))
     / NULLIF(LAG(Total) OVER (PARTITION BY BranchId ORDER BY Mth), 0), 1) AS GrowthPct
FROM Monthly ORDER BY BranchId, Mth;`
    },
    {
      t: "এরপর কী শিখবে",
      bn: "📦 <b>Partitioning</b> — ১০ কোটি+ row-এর table।<br>🧮 <b>Columnstore index</b> — analytics-এ ১০× লাভ।<br>🕰 <b>Temporal table</b> — trigger ছাড়া history।<br>⚡ <b>In-Memory OLTP</b> — hot row-এ চরম write contention।<br>🌐 <b>Distributed isolation</b> — data এক DB ছাড়লে ACID = আলোচনা।",
      en: "Partitioning, columnstore, temporal tables, in-memory OLTP, distributed isolation.",
      mem: "যাদের database-এ বিশ্বাস করা হয় তারা সবচেয়ে বেশি syntax মুখস্থকারী না — তারা <b>set-এ চিন্তা করে</b>, মতামতের আগে <b>actual plan</b> দেখে, জানে প্রতিটা index একটা write-tax, আর আগে-পরে <b>মাপে</b>।"
    }
  ],
  quiz: [
    { q: "TRUNCATE কি rollback করা যায়?", o: ["কখনো না", "SQL Server ও Postgres-এ হ্যাঁ; MySQL-এ না", "শুধু MySQL-এ", "শুধু WHERE থাকলে"], a: 1, e: "MySQL-এ implicit commit।" },
    { q: "১০টার মধ্যে কয়টা UNION আসলে UNION ALL হওয়া উচিত?", o: ["১", "৫", "৯", "০"], a: 2, e: "বইয়ের মতে ৯টা।" },
    { q: "Slow query fast করার প্রশ্নে interviewer কী চায়?", o: ["Trick-এর তালিকা", "পদ্ধতি: মাপো → plan → est vs actual → একটা বদল → যাচাই", "NOLOCK", "Hardware"], a: 1, e: "Method ছাড়া trick = over-indexed table।" },
    { q: "Branch-প্রতি active account গুনতে খালি branch-এ 0 দেখাতে?", o: ["COUNT(*)", "COUNT(a.AccountId) + ON-এ filter", "WHERE a.Status", "INNER JOIN"], a: 1, e: "দুই ফাঁদ এড়িয়ে।" }
  ],
  cards: [
    ["DELETE / TRUNCATE / DROP", "DML row-by-row / DDL page dealloc / table নিজেই মুছে"],
    ["২য় সর্বোচ্চ", "DENSE_RANK() = 2"],
    ["Duplicate মোছা", "ROW_NUMBER() OVER (PARTITION BY key) → DELETE rn > 1"]
  ]
}
);
// Interview cards for chapter 25 viz
const INTERVIEW_QA = [
  ["DELETE vs TRUNCATE vs DROP?", "DELETE = DML, row-by-row, logged, WHERE, trigger fire। TRUNCATE = DDL, page deallocate, minimal log, WHERE নেই, trigger নেই, identity reset — কিন্তু transactional, rollback যায়। DROP = table-ই মুছে দেয়। MySQL-এ TRUNCATE rollback হয় না।"],
  ["Clustered vs nonclustered index?", "Clustered = table নিজেই, key দিয়ে sorted; প্রতি table-এ ১টা। Nonclustered = আলাদা sorted structure, leaf-এ key + clustering key pointer → তাই clustered key সরু হওয়া উচিত। Key lookup = বাকি কলামের জন্য ফেরত যাওয়া, প্রতি row-এ random read → INCLUDE।"],
  ["UNION vs UNION ALL — কোনটা দ্রুত?", "UNION ALL — UNION-কে পুরো set sort/hash করে dedup করতে হয়। Distinct দরকার না হলে UNION ALL।"],
  ["Execution plan কীভাবে পড়ো?", "ডান থেকে বামে। আগে estimated vs actual rows। তারপর seek-এর জায়গায় scan, আগেভাগে মোটা তীর, বেশি key lookup, tempdb spill। Cost % উপেক্ষা।"],
  ["Slow query কীভাবে fast করবে?", "Trick না, পদ্ধতি: মেপে আসল query খোঁজো → actual plan → est vs actual → column-এ function, missing index, RBAR খোঁজো → একটা বদলাও → আবার মাপো → ফল একই কিনা যাচাই।"],
  ["Deadlock কী, কীভাবে আটকাবে?", "Lock-এর চক্র; engine একজনকে victim করে (1205)। আটকাও: সব code path-এ একই lock order, ছোট transaction, পর্যাপ্ত index। সামলাও: সীমিত retry।"],
  ["NOT IN vs NOT EXISTS?", "Subquery NULL দিলে NOT IN শূন্য row দেয়। NOT EXISTS নিরাপদ। Default NOT EXISTS।"],
  ["ROW_NUMBER vs RANK vs DENSE_RANK?", "ROW_NUMBER সবসময় unique। RANK tie-তে সমান, পরে ফাঁক। DENSE_RANK tie-তে সমান, ফাঁক নেই।"],
  ["Parameter sniffing কী?", "প্রথম call-এর parameter দিয়ে plan বানিয়ে cache; পরের সব call সেটাই ব্যবহার করে। Fix: RECOMPILE, OPTIMIZE FOR, Query Store force plan।"],
  ["Table variable fast-for-10, slow-for-100k?", "Statistics নেই → ১ row estimate → nested loops। #temp বা OPTION (RECOMPILE)।"]
];
