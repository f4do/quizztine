CREATE TYPE "QuestionType" AS ENUM ('MCQ');
ALTER TABLE "Question" ADD COLUMN "questionType" "QuestionType" NOT NULL DEFAULT 'MCQ';
