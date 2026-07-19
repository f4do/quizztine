-- CreateEnum
CREATE TYPE "HostAvatarType" AS ENUM ('BUILTIN', 'UPLOAD', 'URL');

-- AlterTable
ALTER TABLE "Host" ADD COLUMN "avatarType" "HostAvatarType" NOT NULL DEFAULT 'BUILTIN';
