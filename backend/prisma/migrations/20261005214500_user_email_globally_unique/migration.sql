-- DropIndex
DROP INDEX IF EXISTS "User_organizationId_email_key";

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
