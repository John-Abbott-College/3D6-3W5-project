USE Project3D63W5;
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

INSERT INTO dbo.Book (EnglishTitle, OriginalTitle, AuthorId, CoverImageId, FirstEditionYear)
VALUES
(
    'Don Quixote',
    'El Ingenioso Hidalgo Don Quijote de la Mancha',
    (SELECT AuthorId FROM Author WHERE AuthorName = N'Miguel de Cervantes'),
    (SELECT Id FROM StoredFile WHERE Filename LIKE 'DonQuixote%'),
    1605
),
(
    'The Art of War', 
    N'孫子兵法', 
    (SELECT AuthorId FROM Author WHERE AuthorName = N'Sun Tzu'), 
    (SELECT Id FROM StoredFile WHERE Filename LIKE 'TheArtOfWar%'),
    NULL
),
(
    'On the Origin of Species', 
    NULL, 
    (SELECT AuthorId FROM Author WHERE AuthorName = N'Charles Darwin'),
    (SELECT Id FROM StoredFile WHERE Filename LIKE 'OnTheOriginOfSpecies%'),
    1859
),
(
    'The Republic', 
    N'Πολιτεία', 
    (SELECT AuthorId FROM Author WHERE AuthorName = N'Plato'),
    (SELECT Id FROM StoredFile WHERE Filename LIKE 'TheRepublic%'),
    -375
),
(
    'The Little Prince', 
    'Le Petit Prince', 
    (SELECT AuthorId FROM Author WHERE AuthorName = N'Antoine de Saint-Exupéry'),
    (SELECT Id FROM StoredFile WHERE Filename LIKE 'LePetitPrince%'),
    1943
);
GO
