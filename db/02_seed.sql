USE StarterDB;
GO
DELETE FROM dbo.Student;
DBCC CHECKIDENT ('dbo.Student', RESEED, 0);
GO
INSERT INTO dbo.Student (FirstName, LastName, Program, Email) VALUES
 (N'Ada',   N'Lovelace', N'Computer Science', N'ada@example.com'),
 (N'Alan',  N'Turing',   N'Computer Science', N'alan@example.com'),
 (N'Grace', N'Hopper',   N'Information Systems', N'grace@example.com');
GO
