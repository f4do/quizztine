-- AlterTable
ALTER TABLE "Host" DROP COLUMN "avatarStyle",
ADD COLUMN "avatarConfig" JSONB NOT NULL DEFAULT '{"topType":"LongHairMiaWallace","hairColor":"Brown","accessoriesType":"Kurt","facialHairType":"Blank","facialHairColor":"Blank","clotheType":"BlazerSweater","clotheColor":"Red","skinColor":"Light"}';
