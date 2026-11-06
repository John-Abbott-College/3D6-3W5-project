-- Re-runnable: safe to run again at any time (it wipes and rebuilds StarterDB).
-- Rename StarterDB everywhere (this file, 02_seed.sql, .env) for your own project.
USE master;
GO
IF DB_ID('3D6Project') IS NOT NULL
BEGIN
    ALTER DATABASE 3D6Project SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE 3D6Project;
END
GO
CREATE DATABASE 3D6Project;
GO
USE 3D6Project;
GO

CREATE TABLE dbo.Book (
    BookId INT IDENTITY(1,1) PRIMARY KEY,
    EnglishTitle VARCHAR(200) NOT NULL,
    OriginalTitle NVARCHAR(200),
    Author NVARCHAR(100),
    FirstEditionYear INT,
);
GO
