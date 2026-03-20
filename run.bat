@echo off
cd packages\db
call npx --yes prisma db push
call npx --yes prisma generate
cd ..\..
call npm run dev
