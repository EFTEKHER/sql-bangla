/* =====================================================================
   BankDB — SQL Server (MSSQL) practice database
   "SQL for Software Developers and Backend Engineers" বইয়ের স্কিমা

   কীভাবে চালাবে:
     SSMS / Azure Data Studio / VS Code (mssql extension)-এ এই পুরো
     file খোলো → Execute (F5)। ১০–২০ সেকেন্ড লাগবে।

   ⚠️ সতর্কতা: এটা BankDB নামের database পুরো মুছে আবার নতুন করে বানায়।
      যতবার চালাবে, ততবার একদম শুরুর অবস্থায় ফিরে যাবে (practice reset)।

   লাগবে: SQL Server 2017 বা নতুন (2019 / 2022 ভালো)।
          Express / Developer edition দুটোই চলবে।

   কী কী পাবে:
     ৬টা মূল table (বইয়ের হুবহু DDL) + বইয়ের উদাহরণে লাগা ৪টা support table
     Branches 6 · Employees 12 · Customers 200 · Accounts ~270
     Transactions ~11,000 · Loans ~32 · CustomerStaging 3
   ===================================================================== */

-- ─────────────────────────────────────────────────────────────────────
-- 0. Database তৈরি (আগে থাকলে মুছে নতুন করে)
-- ─────────────────────────────────────────────────────────────────────
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;   -- indexed view / filtered index-এর জন্য দরকার
GO
USE master;
GO
IF DB_ID(N'BankDB') IS NOT NULL
BEGIN
    ALTER DATABASE BankDB SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE BankDB;
END
GO
CREATE DATABASE BankDB;
GO
-- Chapter 13: SNAPSHOT isolation উদাহরণের জন্য
ALTER DATABASE BankDB SET ALLOW_SNAPSHOT_ISOLATION ON;
GO
USE BankDB;
GO
SET NOCOUNT ON;
GO

-- ─────────────────────────────────────────────────────────────────────
-- 1. Tables (বইয়ের Listing 2.1 – 2.3, হুবহু)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE dbo.Branches (
    BranchId    INT           NOT NULL IDENTITY(1,1),
    BranchCode  CHAR(5)       NOT NULL,
    BranchName  NVARCHAR(100) NOT NULL,
    City        NVARCHAR(60)  NOT NULL,
    OpenedOn    DATE          NOT NULL,
    CONSTRAINT PK_Branches PRIMARY KEY CLUSTERED (BranchId),
    CONSTRAINT UQ_Branches_Code UNIQUE (BranchCode)
);

CREATE TABLE dbo.Employees (
    EmployeeId  INT           NOT NULL IDENTITY(1,1),
    BranchId    INT           NOT NULL,
    ManagerId   INT           NULL,               -- self-reference
    FullName    NVARCHAR(120) NOT NULL,
    Designation NVARCHAR(60)  NOT NULL,
    Salary      DECIMAL(12,2) NOT NULL,
    HiredOn     DATE          NOT NULL,
    CONSTRAINT PK_Employees PRIMARY KEY CLUSTERED (EmployeeId),
    CONSTRAINT FK_Emp_Branch FOREIGN KEY (BranchId)
        REFERENCES dbo.Branches(BranchId),
    CONSTRAINT FK_Emp_Manager FOREIGN KEY (ManagerId)
        REFERENCES dbo.Employees(EmployeeId),
    CONSTRAINT CK_Emp_Salary CHECK (Salary > 0)
);

CREATE TABLE dbo.Customers (
    CustomerId  INT           NOT NULL IDENTITY(1,1),
    NationalId  VARCHAR(20)   NOT NULL,
    FullName    NVARCHAR(120) NOT NULL,
    Email       NVARCHAR(160) NULL,
    Phone       VARCHAR(20)   NULL,
    City        NVARCHAR(60)  NULL,
    KycStatus   VARCHAR(12)   NOT NULL DEFAULT 'PENDING',
    CreatedAt   DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Customers PRIMARY KEY CLUSTERED (CustomerId),
    CONSTRAINT UQ_Customers_Nid UNIQUE (NationalId),
    CONSTRAINT CK_Customers_Kyc CHECK
        (KycStatus IN ('PENDING','VERIFIED','REJECTED'))
);

CREATE TABLE dbo.Accounts (
    AccountId     BIGINT        NOT NULL IDENTITY(1,1),
    AccountNumber CHAR(13)      NOT NULL,
    CustomerId    INT           NOT NULL,
    BranchId      INT           NOT NULL,
    AccountType   VARCHAR(10)   NOT NULL,          -- SAVINGS, CURRENT, FD
    Balance       DECIMAL(19,4) NOT NULL DEFAULT 0,
    Currency      CHAR(3)       NOT NULL DEFAULT 'BDT',
    Status        VARCHAR(10)   NOT NULL DEFAULT 'ACTIVE',
    OpenedOn      DATE          NOT NULL,
    ClosedOn      DATE          NULL,
    CONSTRAINT PK_Accounts PRIMARY KEY CLUSTERED (AccountId),
    CONSTRAINT UQ_Accounts_Number UNIQUE (AccountNumber),
    CONSTRAINT FK_Acc_Customer FOREIGN KEY (CustomerId)
        REFERENCES dbo.Customers(CustomerId),
    CONSTRAINT FK_Acc_Branch FOREIGN KEY (BranchId)
        REFERENCES dbo.Branches(BranchId),
    CONSTRAINT CK_Acc_Type   CHECK (AccountType IN ('SAVINGS','CURRENT','FD')),
    CONSTRAINT CK_Acc_Status CHECK (Status IN ('ACTIVE','DORMANT','CLOSED')),
    CONSTRAINT CK_Acc_Closed CHECK (ClosedOn IS NULL OR ClosedOn >= OpenedOn)
);

CREATE TABLE dbo.Transactions (
    TxnId        BIGINT        NOT NULL IDENTITY(1,1),
    AccountId    BIGINT        NOT NULL,
    TxnDate      DATETIME2(3)  NOT NULL,
    TxnType      VARCHAR(10)   NOT NULL,           -- DEBIT / CREDIT
    Channel      VARCHAR(12)   NOT NULL,           -- ATM, ONLINE, BRANCH, POS
    Amount       DECIMAL(19,4) NOT NULL,
    BalanceAfter DECIMAL(19,4) NOT NULL,
    Reference    NVARCHAR(80)  NULL,
    CONSTRAINT PK_Transactions PRIMARY KEY CLUSTERED (TxnId),
    CONSTRAINT FK_Txn_Account FOREIGN KEY (AccountId)
        REFERENCES dbo.Accounts(AccountId),
    CONSTRAINT CK_Txn_Type   CHECK (TxnType IN ('DEBIT','CREDIT')),
    CONSTRAINT CK_Txn_Amount CHECK (Amount > 0)
);

CREATE TABLE dbo.Loans (
    LoanId       INT           NOT NULL IDENTITY(1,1),
    CustomerId   INT           NOT NULL,
    BranchId     INT           NOT NULL,
    Principal    DECIMAL(19,4) NOT NULL,
    InterestRate DECIMAL(5,2)  NOT NULL,
    TermMonths   INT           NOT NULL,
    DisbursedOn  DATE          NOT NULL,
    Status       VARCHAR(12)   NOT NULL,           -- ACTIVE, CLOSED, DEFAULTED
    CONSTRAINT PK_Loans PRIMARY KEY CLUSTERED (LoanId),
    CONSTRAINT FK_Loan_Customer FOREIGN KEY (CustomerId)
        REFERENCES dbo.Customers(CustomerId),
    CONSTRAINT FK_Loan_Branch FOREIGN KEY (BranchId)
        REFERENCES dbo.Branches(BranchId)
);
GO

-- ─────────────────────────────────────────────────────────────────────
-- 2. Support tables (বইয়ের উদাহরণ চালাতে লাগে)
-- ─────────────────────────────────────────────────────────────────────
-- Chapter 12: INSERT ... SELECT archive উদাহরণ
CREATE TABLE dbo.ArchivedTransactions (
    TxnId     BIGINT        NOT NULL PRIMARY KEY,
    AccountId BIGINT        NOT NULL,
    TxnDate   DATETIME2(3)  NOT NULL,
    Amount    DECIMAL(19,4) NOT NULL
);

-- Chapter 12: MERGE উদাহরণের source
CREATE TABLE dbo.CustomerStaging (
    NationalId VARCHAR(20)   NOT NULL,
    FullName   NVARCHAR(120) NOT NULL,
    Email      NVARCHAR(160) NULL,
    City       NVARCHAR(60)  NULL
);

-- Chapter 15: audit trigger এখানে লেখে
CREATE TABLE dbo.AccountAudit (
    AuditId    BIGINT        NOT NULL IDENTITY(1,1) PRIMARY KEY,
    AccountId  BIGINT        NOT NULL,
    OldBalance DECIMAL(19,4) NULL,
    NewBalance DECIMAL(19,4) NULL,
    OldStatus  VARCHAR(10)   NULL,
    NewStatus  VARCHAR(10)   NULL,
    ChangedBy  NVARCHAR(128) NOT NULL,
    ChangedAt  DATETIME2(3)  NOT NULL
);

-- Chapter 18: CATCH block এখানে error log করে
CREATE TABLE dbo.ErrorLog (
    ErrorLogId     INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    ErrorNumber    INT            NULL,
    ErrorMessage   NVARCHAR(4000) NULL,
    ErrorProcedure NVARCHAR(128)  NULL,
    ErrorLine      INT            NULL,
    LoggedAt       DATETIME2(3)   NOT NULL
);
GO

-- ─────────────────────────────────────────────────────────────────────
-- 3. Branches — ৬টা শাখা
--    (SYL01 / KHL01 / RAJ01 ইচ্ছা করে বাদ — Chapter 12-এর INSERT
--     উদাহরণে তুমি নিজে এগুলো যোগ করবে)
--    Kandirpar (CMB01)-এ কোনো employee নেই → NOT EXISTS অনুশীলনের জন্য
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO dbo.Branches (BranchCode, BranchName, City, OpenedOn)
VALUES ('DHK01', N'Gulshan Corporate', N'Dhaka',      '2005-03-01'),   -- 1
       ('DHK02', N'Motijheel Main',    N'Dhaka',      '1998-07-15'),   -- 2
       ('CTG01', N'Agrabad',           N'Chattogram', '2001-01-10'),   -- 3
       ('DHK03', N'Uttara',            N'Dhaka',      '2012-09-01'),   -- 4
       ('CTG02', N'Nasirabad',         N'Chattogram', '2015-04-20'),   -- 5
       ('CMB01', N'Kandirpar',         N'Cumilla',    '2019-11-05');   -- 6
GO

-- ─────────────────────────────────────────────────────────────────────
-- 4. Employees — ১২ জন, ৪ level-এর hierarchy (Chapter 5 self join,
--    Chapter 9 recursive CTE)। CEO-র ManagerId = NULL।
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO dbo.Employees (BranchId, ManagerId, FullName, Designation, Salary, HiredOn)
VALUES (1, NULL, N'Ayesha Siddiqua', N'CEO',            450000, '2005-03-01'),  -- 1
       (1, 1,    N'Bashir Ahmed',    N'CTO',            320000, '2010-06-01'),  -- 2
       (2, 1,    N'Farhana Islam',   N'CFO',            310000, '2011-01-15'),  -- 3
       (1, 2,    N'Imran Hossain',   N'Dev Lead',       180000, '2015-04-01'),  -- 4
       (1, 4,    N'Jannat Ara',      N'Developer',       95000, '2020-08-01'),  -- 5
       (3, 4,    N'Liza Rahman',     N'Developer',       90000, '2021-09-01'),  -- 6
       (2, 3,    N'Kamal Uddin',     N'Accountant',      70000, '2018-02-01'),  -- 7
       (3, 1,    N'Mahmud Hasan',    N'Branch Manager', 160000, '2012-05-10'),  -- 8
       (3, 8,    N'Sumaiya Khatun',  N'Teller',          45000, '2022-01-03'),  -- 9
       (4, 8,    N'Rakib Hasan',     N'Teller',          45000, '2023-03-15'),  -- 10
       (5, 1,    N'Tasnim Ferdous',  N'Branch Manager', 155000, '2016-07-01'),  -- 11
       (5, 11,   N'Jamal Uddin',     N'Teller',          42000, '2024-02-11');  -- 12
GO

-- ─────────────────────────────────────────────────────────────────────
-- 5. Customers — প্রথম ১২ জন হাতে লেখা (বইয়ের Rahim, Karim, Nusrat সহ),
--    বাকি ১৮৮ জন নিচে generate করা।
--    Nusrat (Id 3)-এর কোনো account নেই → anti-join অনুশীলনের জন্য।
--    কয়েকজনের Email / Phone NULL → NULL অধ্যায়ের জন্য।
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO dbo.Customers (NationalId, FullName, Email, Phone, City, KycStatus, CreatedAt)
VALUES ('1990123456', N'Rahim Uddin',     N'rahim@example.com',  '01711000001', N'Dhaka',      'VERIFIED', '2019-01-10'),  -- 1
       ('1985987654', N'Karim Hossain',   N'karim@example.com',  NULL,          N'Dhaka',      'VERIFIED', '2019-05-02'),  -- 2
       ('1999111222', N'Nusrat Jahan',    NULL,                  '01811000003', N'Chattogram', 'PENDING',  '2025-11-20'),  -- 3
       ('1992333444', N'Tanvir Rahman',   NULL,                  NULL,          N'Sylhet',     'VERIFIED', '2021-03-03'),  -- 4
       ('1988555666', N'Sadia Akter',     N'sadia@example.com',  '01911000005', N'Dhaka',      'VERIFIED', '2020-07-07'),  -- 5
       ('1995777888', N'Rahat Khan',      N'rahat@example.com',  NULL,          N'Chattogram', 'REJECTED', '2024-02-14'),  -- 6
       ('1991222333', N'Farzana Haque',   N'farzana@example.com','01611000007', N'Chattogram', 'VERIFIED', '2020-10-01'),  -- 7
       ('1987444555', N'Mehedi Hasan',    NULL,                  '01511000008', N'Dhaka',      'VERIFIED', '2018-12-12'),  -- 8
       ('1993666777', N'Sharmin Sultana', N'sharmin@example.com','01311000009', N'Cumilla',    'VERIFIED', '2022-04-18'),  -- 9
       ('1989888999', N'Arif Chowdhury',  N'arif@example.com',   NULL,          N'Dhaka',      'PENDING',  '2023-08-08'),  -- 10
       ('1996000111', N'Nabila Islam',    N'nabila@example.com', '01711000011', N'Khulna',     'VERIFIED', '2024-06-30'),  -- 11
       ('1994121212', N'Shakil Ahmed',    NULL,                  '01811000012', N'Rajshahi',   'PENDING',  '2025-09-09'); -- 12
GO

-- বাকি ১৮৮ জন customer (Id 13–200)
;WITH N AS (
    SELECT TOP (188) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n
    FROM sys.all_objects
)
INSERT INTO dbo.Customers (NationalId, FullName, Email, Phone, City, KycStatus, CreatedAt)
SELECT CAST(1960000000 + n * 9973 AS VARCHAR(20)),
       CHOOSE(n % 20 + 1, N'Abdul', N'Anika', N'Babul', N'Bithi', N'Farhan', N'Fatema', N'Habib', N'Israt',
                          N'Jahid', N'Lamia', N'Masud', N'Moumita', N'Nayeem', N'Priya', N'Rafiq', N'Rumana',
                          N'Sabbir', N'Tahmina', N'Yasin', N'Zarin')
         + N' ' +
       CHOOSE((n / 20) % 10 + 1, N'Ahmed', N'Hossain', N'Islam', N'Rahman', N'Khan', N'Chowdhury',
                                 N'Akter', N'Uddin', N'Sarkar', N'Mia'),
       CASE WHEN n % 4 = 0 THEN NULL ELSE N'user' + CAST(n + 12 AS NVARCHAR(10)) + N'@example.com' END,
       CASE WHEN n % 3 = 0 THEN NULL ELSE '017' + RIGHT('00000000' + CAST(n * 7331 AS VARCHAR(10)), 8) END,
       CHOOSE(n % 6 + 1, N'Dhaka', N'Dhaka', N'Chattogram', N'Sylhet', N'Khulna', N'Rajshahi'),
       CASE WHEN n % 11 = 0 THEN 'REJECTED' WHEN n % 5 = 0 THEN 'PENDING' ELSE 'VERIFIED' END,
       DATEADD(DAY, n * 9, CAST('2018-01-01' AS DATETIME2(3)))
FROM N;
GO

-- ─────────────────────────────────────────────────────────────────────
-- 6. Accounts — প্রথম ১৩টা হাতে লেখা, বাকিগুলো generate করা।
--    Balance এখানে "opening balance"; transaction যোগ হওয়ার পর
--    নিচে (ধাপ ৯) আসল balance হিসাব করে update হবে।
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO dbo.Accounts (AccountNumber, CustomerId, BranchId, AccountType, Balance, Status, OpenedOn, ClosedOn)
VALUES ('1001000000001',  1, 1, 'SAVINGS',   85000.00, 'ACTIVE',  '2020-02-01', NULL),          -- 1
       ('1001000000002',  1, 1, 'CURRENT',  250000.00, 'ACTIVE',  '2021-06-11', NULL),          -- 2
       ('1001000000003',  2, 2, 'SAVINGS',    4300.50, 'ACTIVE',  '2019-11-23', NULL),          -- 3
       ('1001000000004',  2, 2, 'FD',       500000.00, 'DORMANT', '2018-01-05', NULL),          -- 4
       ('1001000000005',  4, 4, 'SAVINGS',  120000.00, 'ACTIVE',  '2021-03-05', NULL),          -- 5
       ('1001000000006',  5, 1, 'CURRENT', 1250000.00, 'ACTIVE',  '2020-07-07', NULL),          -- 6
       ('1001000000007',  5, 3, 'SAVINGS',  250000.00, 'ACTIVE',  '2022-01-01', NULL),          -- 7
       ('1001000000008',  6, 3, 'SAVINGS',       0.00, 'CLOSED',  '2024-02-14', '2025-06-30'),  -- 8
       ('1001000000009',  7, 5, 'SAVINGS',   60000.00, 'ACTIVE',  '2020-10-02', NULL),          -- 9
       ('1001000000010',  8, 2, 'CURRENT',  900000.00, 'ACTIVE',  '2018-12-15', NULL),          -- 10
       ('1001000000011',  9, 6, 'FD',       800000.00, 'ACTIVE',  '2022-04-20', NULL),          -- 11
       ('1001000000012', 10, 4, 'SAVINGS',   15000.00, 'ACTIVE',  '2023-08-09', NULL),          -- 12
       ('1001000000013', 11, 1, 'SAVINGS',    3000.00, 'ACTIVE',  '2024-07-01', NULL);          -- 13
GO

-- Generated accounts: customer 13–200, প্রত্যেকের SAVINGS; প্রতি ৩ জনে
-- একজনের CURRENT; প্রতি ১০ জনে একজনের FD। CustomerId % 17 = 0 হলে কোনো
-- account নেই। কিছু DORMANT আর CLOSED।
;WITH src AS (
    SELECT c.CustomerId, v.AccountType,
           ROW_NUMBER() OVER (ORDER BY c.CustomerId, v.AccountType) AS rn
    FROM dbo.Customers AS c
    CROSS APPLY (VALUES ('SAVINGS', 1), ('CURRENT', 3), ('FD', 10)) AS v(AccountType, EveryN)
    WHERE c.CustomerId >= 13
      AND c.CustomerId % 17 <> 0
      AND c.CustomerId % v.EveryN = 0
)
INSERT INTO dbo.Accounts (AccountNumber, CustomerId, BranchId, AccountType, Balance, Status, OpenedOn, ClosedOn)
SELECT '1001' + RIGHT('000000000' + CAST(100 + rn AS VARCHAR(9)), 9),
       CustomerId,
       CustomerId % 6 + 1,
       AccountType,
       CASE WHEN rn % 41 = 0 THEN 0 ELSE CAST((rn * 7919) % 400 * 1000 + 5000 AS DECIMAL(19,4)) END,
       CASE WHEN rn % 41 = 0 THEN 'CLOSED' WHEN rn % 23 = 0 THEN 'DORMANT' ELSE 'ACTIVE' END,
       DATEADD(DAY, (rn * 37) % 2000, CAST('2018-01-01' AS DATE)),
       CASE WHEN rn % 41 = 0 THEN CAST('2025-12-31' AS DATE) END
FROM src;
GO

-- ─────────────────────────────────────────────────────────────────────
-- 7. Transactions
--    (ক) হাতে লেখা কিছু বিশেষ row:
--        • Account 3: ২০২৬-০১-২০ তারিখে ২৪ ঘণ্টায় ৫টা debit
--          → Chapter 25 velocity check
--        • Account 1: ২০২৬-০১-০১ থেকে টানা ৫ দিন activity
--          → Chapter 10 gaps & islands
--        • ৩১ জানুয়ারির মধ্যরাতের পরের row → Chapter 4 BETWEEN ফাঁদ
--    (খ) বাকি ~১১,০০০ row generate করা (২০২৫-০১-০১ থেকে ২০২৬-১০-৩১)
--    BalanceAfter আপাতত 0; ধাপ ৯-এ running total দিয়ে ঠিক করা হবে।
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO dbo.Transactions (AccountId, TxnDate, TxnType, Channel, Amount, BalanceAfter, Reference)
VALUES (3, '2026-01-20 10:00:00', 'DEBIT',  'ATM',    500, 0, NULL),
       (3, '2026-01-20 11:00:00', 'DEBIT',  'ATM',    500, 0, NULL),
       (3, '2026-01-20 12:30:00', 'DEBIT',  'POS',    300, 0, N'{"merchant":"Shwapno","deviceId":"D-11"}'),
       (3, '2026-01-20 14:00:00', 'DEBIT',  'ATM',    200, 0, NULL),
       (3, '2026-01-20 16:45:00', 'DEBIT',  'ONLINE', 500, 0, N'bKash transfer'),
       (3, '2025-12-01 09:00:00', 'CREDIT', 'BRANCH', 5000, 0, N'Salary'),
       (1, '2026-01-01 09:15:00', 'CREDIT', 'BRANCH', 20000, 0, N'Salary'),
       (1, '2026-01-02 10:00:00', 'DEBIT',  'ATM',    5000, 0, NULL),
       (1, '2026-01-03 11:30:00', 'DEBIT',  'POS',    1500, 0, N'{"merchant":"Daraz","deviceId":"D-77"}'),
       (1, '2026-01-04 18:20:00', 'CREDIT', 'ONLINE', 3000, 0, N'bKash in'),
       (1, '2026-01-05 08:05:00', 'DEBIT',  'ONLINE', 2000, 0, N'Electricity bill'),
       (1, '2026-01-31 10:30:00', 'CREDIT', 'BRANCH', 20000, 0, N'Salary'),
       (2, '2026-01-31 23:59:59.500', 'DEBIT', 'ONLINE', 50000, 0, N'Vendor payment');
GO

;WITH N AS (
    SELECT TOP (80) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n
    FROM sys.all_objects
)
INSERT INTO dbo.Transactions (AccountId, TxnDate, TxnType, Channel, Amount, BalanceAfter, Reference)
SELECT a.AccountId, d.TxnDate, d.TxnType, d.Channel, d.Amount, 0,
       CASE WHEN d.Channel = 'POS'
                THEN N'{"merchant":"' + CHOOSE(k.id % 5 + 1, N'Daraz', N'Shwapno', N'Aarong', N'Foodpanda', N'Chaldal')
                     + N'","deviceId":"D-' + CAST(N.n AS NVARCHAR(10)) + N'"}'
            WHEN N.n % 53 = 0 THEN N'50% cashback offer'
            WHEN d.TxnType = 'CREDIT' AND d.Channel = 'BRANCH' THEN N'Salary'
       END
FROM dbo.Accounts AS a
CROSS APPLY (SELECT CAST(a.AccountId AS INT) AS id) AS k
JOIN N ON N.n <= 20 + (k.id % 5) * 12                    -- account প্রতি ২০–৬৮টা
CROSS APPLY (
    SELECT DATEADD(MINUTE, (N.n * 9173 + k.id * 4271) % 963360,   -- ৬৬৯ দিন × ১৪৪০ মিনিট
                   CAST('2025-01-01' AS DATETIME2(3))) AS TxnDate,
           CASE WHEN (N.n + k.id) % 3 = 0 THEN 'CREDIT' ELSE 'DEBIT' END AS TxnType,
           CASE WHEN N.n % 37 = 0 THEN 'WEB'                       -- Chapter 16 backfill উদাহরণ
                ELSE CHOOSE((N.n * 3 + k.id) % 5 + 1, 'ATM', 'ONLINE', 'BRANCH', 'POS', 'ONLINE') END AS Channel,
           CAST(CASE WHEN (N.n + k.id) % 3 = 0
                     THEN ((N.n * 7919 + k.id * 104729) % 4900 + 100) * 10   -- credit: 1,000–50,000
                     ELSE  (N.n * 7919 + k.id * 104729) % 4900 + 100         -- debit:    100–5,000
                END AS DECIMAL(19,4)) AS Amount
) AS d
WHERE a.Status = 'ACTIVE'          -- DORMANT/CLOSED account-এ নতুন transaction নেই
  AND a.AccountId NOT IN (3);      -- account 3-এর row উপরে হাতে লেখা
GO

-- ─────────────────────────────────────────────────────────────────────
-- 8. Loans — কিছু হাতে লেখা + প্রতি ৭ম customer-এর একটা
--    Customer 1-এর ২টা account × ৩টা loan → Chapter 5 fan-out bug
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO dbo.Loans (CustomerId, BranchId, Principal, InterestRate, TermMonths, DisbursedOn, Status)
VALUES (1, 1, 500000,  9.50, 36, '2024-01-01', 'ACTIVE'),
       (1, 1, 200000, 10.00, 24, '2025-01-01', 'ACTIVE'),
       (1, 2, 100000, 11.00, 12, '2023-06-01', 'CLOSED'),
       (4, 4, 300000,  9.00, 48, '2026-02-15', 'ACTIVE'),
       (6, 3, 150000, 12.00, 24, '2024-03-01', 'DEFAULTED');

INSERT INTO dbo.Loans (CustomerId, BranchId, Principal, InterestRate, TermMonths, DisbursedOn, Status)
SELECT c.CustomerId,
       c.CustomerId % 6 + 1,
       (c.CustomerId * 7919 % 50 + 1) * 20000,
       CAST(8.5 + (c.CustomerId % 13) * 0.25 AS DECIMAL(5,2)),
       CHOOSE(c.CustomerId % 4 + 1, 12, 24, 36, 60),
       DATEADD(DAY, c.CustomerId * 11 % 1500, CAST('2021-01-01' AS DATE)),
       CASE WHEN c.CustomerId % 49 = 0 THEN 'DEFAULTED'
            WHEN c.CustomerId % 3  = 0 THEN 'CLOSED'
            ELSE 'ACTIVE' END
FROM dbo.Customers AS c
WHERE c.CustomerId >= 13 AND c.CustomerId % 7 = 0;
GO

-- ─────────────────────────────────────────────────────────────────────
-- 9. BalanceAfter ও Accounts.Balance হিসাব (Chapter 24: denormalized
--    balance সবসময় transaction-এর যোগফলের সাথে মিলতে হবে)
--    BalanceAfter = opening balance + সেই মুহূর্ত পর্যন্ত running total
-- ─────────────────────────────────────────────────────────────────────
SELECT t.TxnId,
       a.Balance + SUM(CASE WHEN t.TxnType = 'CREDIT' THEN t.Amount ELSE -t.Amount END)
           OVER (PARTITION BY t.AccountId ORDER BY t.TxnDate, t.TxnId
                 ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS NewBalance
INTO #RunningBalance
FROM dbo.Transactions AS t
JOIN dbo.Accounts     AS a ON a.AccountId = t.AccountId;

UPDATE t
SET    t.BalanceAfter = r.NewBalance
FROM   dbo.Transactions AS t
JOIN   #RunningBalance  AS r ON r.TxnId = t.TxnId;

UPDATE a
SET    a.Balance = last.BalanceAfter
FROM   dbo.Accounts AS a
CROSS APPLY (SELECT TOP (1) t.BalanceAfter
             FROM dbo.Transactions AS t
             WHERE t.AccountId = a.AccountId
             ORDER BY t.TxnDate DESC, t.TxnId DESC) AS last;

DROP TABLE #RunningBalance;
GO

-- ─────────────────────────────────────────────────────────────────────
-- 10. CustomerStaging — Chapter 12 MERGE-এর জন্য
--     Rahim: নাম/email বদলেছে → UPDATE হবে
--     Karim: কিছুই বদলায়নি → কিছু হবে না
--     Mitu:  নতুন → INSERT হবে
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO dbo.CustomerStaging (NationalId, FullName, Email, City)
VALUES ('1990123456', N'Rahim Uddin Khan', N'rahim.khan@example.com', N'Dhaka'),
       ('1985987654', N'Karim Hossain',    N'karim@example.com',      N'Dhaka'),
       ('2002777888', N'Mitu Akter',       N'mitu@example.com',       N'Barishal');
GO

-- ─────────────────────────────────────────────────────────────────────
-- 11. যাচাই — প্রতিটা table-এ কত row
-- ─────────────────────────────────────────────────────────────────────
SELECT 'Branches'             AS TableName, COUNT(*) AS RowsLoaded FROM dbo.Branches
UNION ALL SELECT 'Employees',            COUNT(*) FROM dbo.Employees
UNION ALL SELECT 'Customers',            COUNT(*) FROM dbo.Customers
UNION ALL SELECT 'Accounts',             COUNT(*) FROM dbo.Accounts
UNION ALL SELECT 'Transactions',         COUNT(*) FROM dbo.Transactions
UNION ALL SELECT 'Loans',                COUNT(*) FROM dbo.Loans
UNION ALL SELECT 'CustomerStaging',      COUNT(*) FROM dbo.CustomerStaging
UNION ALL SELECT 'ArchivedTransactions', COUNT(*) FROM dbo.ArchivedTransactions
UNION ALL SELECT 'AccountAudit',         COUNT(*) FROM dbo.AccountAudit
UNION ALL SELECT 'ErrorLog',             COUNT(*) FROM dbo.ErrorLog;
GO

PRINT N'✅ BankDB তৈরি হয়েছে। এখন বইয়ের যেকোনো SQL চালাও: USE BankDB;';
GO

/* =====================================================================
   🧪 শুরু করার জন্য কয়েকটা query

   USE BankDB;

   -- Chapter 1: logical order
   SELECT TOP (5) c.FullName, COUNT(*) AS TxnCount
   FROM dbo.Customers AS c
   JOIN dbo.Accounts AS a ON a.CustomerId = c.CustomerId
   JOIN dbo.Transactions AS t ON t.AccountId = a.AccountId
   WHERE t.TxnDate >= '2026-01-01'
   GROUP BY c.FullName
   HAVING COUNT(*) > 10
   ORDER BY TxnCount DESC;

   -- Chapter 20: index বানাও, তারপর execution plan (Ctrl+M) তুলনা করো
   SET STATISTICS IO, TIME ON;
   SELECT * FROM dbo.Transactions WHERE AccountId = 10;     -- index-এর আগে: Scan
   CREATE NONCLUSTERED INDEX IX_Txn_Account_Date
       ON dbo.Transactions (AccountId, TxnDate);
   SELECT * FROM dbo.Transactions WHERE AccountId = 10;     -- এখন: Seek + Key Lookup

   -- আবার শুরু থেকে চাও? এই পুরো file আবার চালাও।
   ===================================================================== */
