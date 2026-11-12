USE Project3D63W5;
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
    -- UUID of the cover image held by the file-store service (file-store/server.js).
    -- NULL = no cover. No foreign key is possible: the file lives outside the database.
    CoverImageId UNIQUEIDENTIFIER NULL,
    FOREIGN KEY (AuthorId) REFERENCES dbo.Author(AuthorId)
);
GO

