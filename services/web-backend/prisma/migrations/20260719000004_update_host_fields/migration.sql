-- AlterTable
ALTER TABLE "Host" DROP COLUMN "title",
ADD COLUMN "avatarStyle" TEXT NOT NULL DEFAULT 'classic';
