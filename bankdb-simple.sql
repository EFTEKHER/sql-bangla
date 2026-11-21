/* =====================================================================
   BankDB — ছোট version (হাতে লেখার জন্য)
   "SQL for Software Developers and Backend Engineers" বইয়ের স্কিমা

   ✍️ সব data সরাসরি INSERT ... VALUES-এ লেখা — দেখে দেখে হাতে লেখা যায়।
      কোনো generate কৌশল নেই। ধাপ ০ থেকে ৮ ক্রমানুসারে চালাও।

   ⚠️ STEP 0 BankDB database মুছে নতুন করে বানায় (practice reset)।
   লাগবে: SQL Server 2017 বা নতুন (Express / Developer)।

   Branches 6 · Employees 12 · Customers 12 · Accounts 13
   Transactions 42 · Loans 6 · CustomerStaging 3
   ===================================================================== */

-- ─────────────────────────────────────────────────────────────────────
-- ▶ STEP 0: Database তৈরি
-- আগে থাকলে মুছে নতুন করে বানায়।
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
-- ▶ STEP 1: Branches (শাখা)
-- ৬টা শাখা। Kandirpar (CMB01)-এ কোনো employee নেই।
-- ─────────────────────────────────────────────────────────────────────
USE BankDB;
GO

CREATE TABLE dbo.Branches (
    BranchId    INT           NOT NULL IDENTITY(1,1),
    BranchCode  CHAR(5)       NOT NULL,
    BranchName  NVARCHAR(100) NOT NULL,
    City        NVARCHAR(60)  NOT NULL,
    OpenedOn    DATE          NOT NULL,
    CONSTRAINT PK_Branches PRIMARY KEY CLUSTERED (BranchId),
    CONSTRAINT UQ_Branches_Code UNIQUE (BranchCode)
);
GO

INSERT INTO dbo.Branches (BranchCode, BranchName, City, OpenedOn)
VALUES ('DHK01', N'Gulshan Corporate', N'Dhaka',      '2005-03-01'),   -- 1
       ('DHK02', N'Motijheel Main',    N'Dhaka',      '1998-07-15'),   -- 2
       ('CTG01', N'Agrabad',           N'Chattogram', '2001-01-10'),   -- 3
       ('DHK03', N'Uttara',            N'Dhaka',      '2012-09-01'),   -- 4
       ('CTG02', N'Nasirabad',         N'Chattogram', '2015-04-20'),   -- 5
       ('CMB01', N'Kandirpar',         N'Cumilla',    '2019-11-05');   -- 6
GO

-- ─────────────────────────────────────────────────────────────────────
-- ▶ STEP 2: Employees (কর্মী)
-- ১২ জন। ManagerId = boss-এর EmployeeId; CEO-র NULL।
-- ─────────────────────────────────────────────────────────────────────
USE BankDB;
GO

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
GO

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
-- ▶ STEP 3: Customers (গ্রাহক)
-- ১২ জন। Nusrat (3) আর Shakil (12)-এর কোনো account থাকবে না।
-- ─────────────────────────────────────────────────────────────────────
USE BankDB;
GO

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
GO

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

-- ─────────────────────────────────────────────────────────────────────
-- ▶ STEP 4: Accounts (অ্যাকাউন্ট)
-- ১৩টা। Balance = সব লেনদেনের পরে এখনকার টাকা (STEP 5-এর শেষ BalanceAfter)।
-- ─────────────────────────────────────────────────────────────────────
USE BankDB;
GO

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
GO

INSERT INTO dbo.Accounts (AccountNumber, CustomerId, BranchId, AccountType, Balance, Status, OpenedOn, ClosedOn)
VALUES ('1001000000001',  1, 1, 'SAVINGS',     169500, 'ACTIVE' , '2020-02-01', NULL        ),  --  1. Rahim
       ('1001000000002',  1, 1, 'CURRENT',     363000, 'ACTIVE' , '2021-06-11', NULL        ),  --  2. Rahim (২য় account)
       ('1001000000003',  2, 2, 'SAVINGS',    7300.50, 'ACTIVE' , '2019-11-23', NULL        ),  --  3. Karim
       ('1001000000004',  2, 2, 'FD'     ,     500000, 'DORMANT', '2018-01-05', NULL        ),  --  4. Karim — DORMANT
       ('1001000000005',  4, 4, 'SAVINGS',     114500, 'ACTIVE' , '2021-03-05', NULL        ),  --  5. Tanvir
       ('1001000000006',  5, 1, 'CURRENT',    1572000, 'ACTIVE' , '2020-07-07', NULL        ),  --  6. Sadia
       ('1001000000007',  5, 3, 'SAVINGS',     275000, 'ACTIVE' , '2022-01-01', NULL        ),  --  7. Sadia (২য় account)
       ('1001000000008',  6, 3, 'SAVINGS',          0, 'CLOSED' , '2024-02-14', '2025-06-30'),  --  8. Rahat — CLOSED
       ('1001000000009',  7, 5, 'SAVINGS',      72800, 'ACTIVE' , '2020-10-02', NULL        ),  --  9. Farzana
       ('1001000000010',  8, 2, 'CURRENT',     830000, 'ACTIVE' , '2018-12-15', NULL        ),  -- 10. Mehedi
       ('1001000000011',  9, 6, 'FD'     ,     800000, 'ACTIVE' , '2022-04-20', NULL        ),  -- 11. Sharmin
       ('1001000000012', 10, 4, 'SAVINGS',      11000, 'ACTIVE' , '2023-08-09', NULL        ),  -- 12. Arif
       ('1001000000013', 11, 1, 'SAVINGS',       8000, 'ACTIVE' , '2024-07-01', NULL        );  -- 13. Nabila
GO

-- ─────────────────────────────────────────────────────────────────────
-- ▶ STEP 5: Transactions (লেনদেন)
-- 42টা লেনদেন, account অনুযায়ী সাজানো।
-- BalanceAfter = এই লেনদেনের পরে account-এ কত টাকা থাকল।
-- ─────────────────────────────────────────────────────────────────────
USE BankDB;
GO

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
GO

INSERT INTO dbo.Transactions (AccountId, TxnDate, TxnType, Channel, Amount, BalanceAfter, Reference)
VALUES
       -- Account 1 (Rahim)
       ( 1, '2025-11-05 10:00:00', 'CREDIT', 'BRANCH',  20000,     105000, N'Salary'),
       ( 1, '2025-12-05 10:00:00', 'CREDIT', 'BRANCH',  20000,     125000, N'Salary'),
       ( 1, '2025-12-18 19:30:00', 'DEBIT' , 'POS'   ,   3500,     121500, N'{"merchant":"Aarong","deviceId":"D-21"}'),
       ( 1, '2026-01-01 09:15:00', 'CREDIT', 'BRANCH',  20000,     141500, N'Salary'),
       ( 1, '2026-01-02 10:00:00', 'DEBIT' , 'ATM'   ,   5000,     136500, NULL),
       ( 1, '2026-01-03 11:30:00', 'DEBIT' , 'POS'   ,   1500,     135000, N'{"merchant":"Daraz","deviceId":"D-77"}'),
       ( 1, '2026-01-04 18:20:00', 'CREDIT', 'ONLINE',   3000,     138000, N'bKash in'),
       ( 1, '2026-01-05 08:05:00', 'DEBIT' , 'ONLINE',   2000,     136000, N'Electricity bill'),
       ( 1, '2026-01-31 10:30:00', 'CREDIT', 'BRANCH',  20000,     156000, N'Salary'),
       ( 1, '2026-02-15 14:00:00', 'DEBIT' , 'POS'   ,   6500,     149500, N'{"merchant":"Shwapno","deviceId":"D-11"}'),
       ( 1, '2026-03-05 10:00:00', 'CREDIT', 'BRANCH',  20000,     169500, N'Salary'),

       -- Account 2 (Rahim (২য় account))
       ( 2, '2025-10-10 12:00:00', 'CREDIT', 'ONLINE', 100000,     350000, N'Invoice #1021'),
       ( 2, '2026-01-03 09:00:00', 'CREDIT', 'ONLINE', 100000,     450000, N'Invoice 50% advance'),
       ( 2, '2026-01-31 23:59:59.500', 'DEBIT' , 'ONLINE',  50000,     400000, N'Vendor payment'),
       ( 2, '2026-02-10 15:00:00', 'DEBIT' , 'BRANCH',  25000,     375000, NULL),
       ( 2, '2026-03-05 10:00:00', 'DEBIT' , 'WEB'   ,  12000,     363000, N'Office rent'),

       -- Account 3 (Karim)
       ( 3, '2025-12-01 09:00:00', 'CREDIT', 'BRANCH',   5000,    9300.50, N'Salary'),
       ( 3, '2026-01-20 10:00:00', 'DEBIT' , 'ATM'   ,    500,    8800.50, NULL),
       ( 3, '2026-01-20 11:00:00', 'DEBIT' , 'ATM'   ,    500,    8300.50, NULL),
       ( 3, '2026-01-20 12:30:00', 'DEBIT' , 'POS'   ,    300,    8000.50, N'{"merchant":"Shwapno","deviceId":"D-11"}'),
       ( 3, '2026-01-20 14:00:00', 'DEBIT' , 'ATM'   ,    200,    7800.50, NULL),
       ( 3, '2026-01-20 16:45:00', 'DEBIT' , 'ONLINE',    500,    7300.50, N'bKash transfer'),

       -- Account 4 (Karim — DORMANT)
       ( 4, '2024-06-01 11:00:00', 'CREDIT', 'BRANCH', 500000,     500000, N'FD deposit'),

       -- Account 5 (Tanvir)
       ( 5, '2026-02-02 10:00:00', 'CREDIT', 'BRANCH',  20000,     120000, N'Deposit'),
       ( 5, '2026-03-10 13:00:00', 'DEBIT' , 'ATM'   ,   4000,     116000, NULL),
       ( 5, '2026-04-12 20:15:00', 'DEBIT' , 'WEB'   ,   1500,     114500, N'Mobile recharge'),

       -- Account 6 (Sadia)
       ( 6, '2026-01-10 10:00:00', 'CREDIT', 'ONLINE', 300000,    1550000, N'Client payment'),
       ( 6, '2026-02-11 10:00:00', 'DEBIT' , 'ONLINE',  50000,    1500000, N'Salary payout'),
       ( 6, '2026-03-12 10:00:00', 'CREDIT', 'ONLINE',  80000,    1580000, N'Client payment'),
       ( 6, '2026-03-20 21:00:00', 'DEBIT' , 'POS'   ,   8000,    1572000, N'{"merchant":"Foodpanda","deviceId":"D-42"}'),

       -- Account 7 (Sadia (২য় account))
       ( 7, '2026-01-15 10:00:00', 'CREDIT', 'BRANCH',  25000,     275000, N'Salary'),
       ( 7, '2026-03-15 10:00:00', 'DEBIT' , 'ATM'   ,  10000,     265000, NULL),
       ( 7, '2026-03-16 10:00:00', 'CREDIT', 'ATM'   ,  10000,     275000, N'Cash deposit'),

       -- Account 8 (Rahat — CLOSED)
       ( 8, '2025-06-30 12:00:00', 'DEBIT' , 'BRANCH',   1200,          0, N'Account closing withdrawal'),

       -- Account 9 (Farzana)
       ( 9, '2026-01-25 18:40:00', 'DEBIT' , 'POS'   ,   2200,      57800, N'{"merchant":"Chaldal","deviceId":"D-35"}'),
       ( 9, '2026-02-25 10:00:00', 'CREDIT', 'ONLINE',  15000,      72800, N'Freelance income'),

       -- Account 10 (Mehedi)
       (10, '2025-12-20 11:00:00', 'DEBIT' , 'ONLINE', 150000,     750000, N'Supplier'),
       (10, '2026-01-20 11:00:00', 'CREDIT', 'ONLINE', 200000,     950000, N'Sales'),
       (10, '2026-02-20 11:00:00', 'DEBIT' , 'ONLINE', 120000,     830000, N'Supplier'),

       -- Account 12 (Arif)
       (12, '2026-04-01 10:00:00', 'DEBIT' , 'ATM'   ,   2000,      13000, NULL),
       (12, '2026-04-01 10:00:00', 'DEBIT' , 'ATM'   ,   2000,      11000, NULL),

       -- Account 13 (Nabila)
       (13, '2026-05-01 09:30:00', 'CREDIT', 'ONLINE',   5000,       8000, N'Scholarship');
GO

-- ─────────────────────────────────────────────────────────────────────
-- ▶ STEP 6: Loans (ঋণ)
-- Rahim (customer 1)-এর ৩টা loan — Chapter 5 fan-out bug-এর জন্য।
-- ─────────────────────────────────────────────────────────────────────
USE BankDB;
GO

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

INSERT INTO dbo.Loans (CustomerId, BranchId, Principal, InterestRate, TermMonths, DisbursedOn, Status)
VALUES (1, 1, 500000,  9.50, 36, '2024-01-01', 'ACTIVE'),
       (1, 1, 200000, 10.00, 24, '2025-01-01', 'ACTIVE'),
       (1, 2, 100000, 11.00, 12, '2023-06-01', 'CLOSED'),
       (4, 4, 300000,  9.00, 48, '2026-02-15', 'ACTIVE'),
       (6, 3, 150000, 12.00, 24, '2024-03-01', 'DEFAULTED'),
       (9, 6, 400000,  8.75, 60, '2025-08-10', 'ACTIVE');
GO

-- ─────────────────────────────────────────────────────────────────────
-- ▶ STEP 7: Support tables
-- বইয়ের Chapter 12, 15, 18-এর উদাহরণ এগুলোতে লেখে।
-- ─────────────────────────────────────────────────────────────────────
USE BankDB;
GO

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

INSERT INTO dbo.CustomerStaging (NationalId, FullName, Email, City)
VALUES ('1990123456', N'Rahim Uddin Khan', N'rahim.khan@example.com', N'Dhaka'),
       ('1985987654', N'Karim Hossain',    N'karim@example.com',      N'Dhaka'),
       ('2002777888', N'Mitu Akter',       N'mitu@example.com',       N'Barishal');
GO

-- ─────────────────────────────────────────────────────────────────────
-- ▶ STEP 8: যাচাই
-- প্রতিটা table-এ কত row লোড হলো।
-- ─────────────────────────────────────────────────────────────────────
USE BankDB;
GO

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

PRINT N'✅ BankDB (ছোট version) তৈরি হয়েছে।';
GO

