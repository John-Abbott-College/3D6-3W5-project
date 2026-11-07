USE Project3D6;
GO

DELETE FROM dbo.Book;
GO

DELETE FROM dbo.Author;
GO

INSERT INTO dbo.Author (AuthorName) VALUES
(N'Miguel de Cervantes'),
(N'Sun Tzu'),
(N'Charles Darwin'),
(N'Plato'),
(N'Antoine de Saint-Exupéry');
GO

INSERT INTO dbo.Book (EnglishTitle, OriginalTitle, AuthorId, FirstEditionYear)
VALUES
(
    'Don Quixote',
    'El Ingenioso Hidalgo Don Quijote de la Mancha',
    (SELECT AuthorId FROM Author WHERE AuthorName = N'Miguel de Cervantes'),
    1605
),
(
    'The Art of War', 
    N'孫子兵法', 
    (SELECT AuthorId FROM Author WHERE AuthorName = N'Sun Tzu'), 
    NULL
),
(
    'On the Origin of Species', 
    NULL, 
    (SELECT AuthorId FROM Author WHERE AuthorName = N'Charles Darwin'), 
    1859
),
(
    'The Republic', 
    N'Πολιτεία', 
    (SELECT AuthorId FROM Author WHERE AuthorName = N'Plato'),
    -375
),
(
    'The Little Prince', 
    'Le Petit Prince', 
    (SELECT AuthorId FROM Author WHERE AuthorName = N'Antoine de Saint-Exupéry'),
    1943
);
GO
