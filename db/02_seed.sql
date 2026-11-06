USE 3D6Project;
GO
DELETE FROM dbo.Book;
DBCC CHECKIDENT ('dbo.Book', RESEED, 0);
GO
INSERT INTO dbo.Book (EnglishTitle, OriginalTitle, Author, FirstEditionYear) VALUES
("Don Quixote", "El Ingenioso Hidalgo Don Quijote de la Mancha", "Miguel de Cervantes", 1605),
("The Art of War", "孫子兵法", "Sun Tzu", NULL),
("On the Origin of Species", NULL, "Charles Darwin", 1859),
("The Republic", "Πολιτεία", Plato, -375),
("The Little Prince", "Le Petit Prince", "Antoine de Saint-Exupéry", 1943)
GO
