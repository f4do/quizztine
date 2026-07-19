-- DropForeignKey
ALTER TABLE "HostPhrase" DROP CONSTRAINT IF EXISTS "HostPhrase_hostId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "HostPhrase_hostId_idx";

-- AlterTable
ALTER TABLE "HostPhrase" DROP COLUMN "hostId";
