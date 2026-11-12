USE master;
GO

-- If database already exists, drop it and create a new one:
IF DB_ID('Project3D63W5') IS NOT NULL
BEGIN
    ALTER DATABASE Project3D63W5 SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE Project3D63W5;
END
GO

CREATE DATABASE Project3D63W5;
GO
