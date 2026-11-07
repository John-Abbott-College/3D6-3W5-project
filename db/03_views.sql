USE Project3D6;
GO

CREATE OR ALTER VIEW dbo.BookDetails AS
SELECT b.BookId, b.EnglishTitle, b.OriginalTitle, b.AuthorId, b.FirstEditionYear, b.CoverImageId, a.AuthorName
FROM dbo.Book AS b
LEFT JOIN dbo.Author AS a
ON a.AuthorId = b.AuthorId;
GO

