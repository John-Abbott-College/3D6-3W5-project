-- file-store.sql
-- Creates the table that holds file metadata for the file-store service.
-- Safe to re-run: it never drops or empties anything (unlike the course db/*.sql scripts).
--
-- Run it in the database that DAB connects to (the Database= part of DAB_CONN).
-- This script uses a dedicated database named FileStore; to use a different one,
-- change the name below and in your connection string.
USE Project3D63W5;
GO

-- Not named "File": FILE is a reserved word in T-SQL.
IF OBJECT_ID('dbo.StoredFile', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.StoredFile (
        -- NEWID() is random, so file URLs can't be guessed. (NEWSEQUENTIALID() is predictable.)
        Id          UNIQUEIDENTIFIER NOT NULL
                    CONSTRAINT DF_StoredFile_Id DEFAULT NEWID()
                    CONSTRAINT PK_StoredFile PRIMARY KEY,
        Filename    NVARCHAR(255) NULL,
        ContentType NVARCHAR(255) NOT NULL,
        Size        BIGINT        NOT NULL CONSTRAINT CK_StoredFile_Size CHECK (Size > 0),
        CreatedAt   DATETIME2(3)  NOT NULL CONSTRAINT DF_StoredFile_CreatedAt DEFAULT SYSUTCDATETIME()
    );
END
GO
