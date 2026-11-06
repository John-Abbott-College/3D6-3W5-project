-- Re-runnable: safe to run again at any time (it wipes and rebuilds StarterDB).
-- Rename StarterDB everywhere (this file, 02_seed.sql, .env) for your own project.
USE master;
GO
IF DB_ID('Project3D6') IS NOT NULL
BEGIN
    ALTER DATABASE Project3D6 SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE Project3D6;
END
GO
CREATE DATABASE Project3D6;
GO
USE Project3D6;
GO

CREATE TABLE dbo.Book (
    BookId INT IDENTITY(1,1) PRIMARY KEY,
    EnglishTitle VARCHAR(200) NOT NULL,
    OriginalTitle NVARCHAR(200),
    Author NVARCHAR(100),
    FirstEditionYear INT,
);
GO
