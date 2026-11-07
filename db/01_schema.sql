USE master;
GO

-- If testing database already exists, drop it and create a new one:
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

CREATE TABLE dbo.Author (
    AuthorId INT IDENTITY(100,1) PRIMARY KEY,
    -- using UNIQUE for usability of the UI:
    AuthorName NVARCHAR(200) UNIQUE NOT NULL, 
);
GO

CREATE TABLE dbo.Book (
    BookId INT IDENTITY(1,1) PRIMARY KEY,
    EnglishTitle VARCHAR(200) NOT NULL,
    OriginalTitle NVARCHAR(200),
    AuthorId INT,
    FirstEditionYear INT,
    FOREIGN KEY (AuthorId) REFERENCES dbo.Author(AuthorId)
);
GO

