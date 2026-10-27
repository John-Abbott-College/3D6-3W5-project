-- Re-runnable: safe to run again at any time (it wipes and rebuilds StarterDB).
-- Rename StarterDB everywhere (this file, 02_seed.sql, .env) for your own project.
USE master;
GO
IF DB_ID('StarterDB') IS NOT NULL
BEGIN
    ALTER DATABASE StarterDB SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE StarterDB;
END
GO
CREATE DATABASE StarterDB;
GO
USE StarterDB;
GO

CREATE TABLE dbo.Student (
    StudentId  INT IDENTITY(1,1) PRIMARY KEY,
    FirstName  NVARCHAR(50)  NOT NULL,
    LastName   NVARCHAR(50)  NOT NULL,
    Program    NVARCHAR(100) NULL,
    Email      NVARCHAR(150) NULL
);
GO
