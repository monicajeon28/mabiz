-- 1. _prisma_migrations 테이블 존재 여부 확인
SELECT table_name FROM information_schema.tables 
WHERE table_name = '_prisma_migrations' AND table_schema = 'public';

-- 2. 테이블 구조 확인
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = '_prisma_migrations' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. 테이블 정의 (DDL) 확인
SELECT pg_get_createtablestmt('public._prisma_migrations'::regclass) AS create_statement;
