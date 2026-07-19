-- CreateTable
CREATE TABLE "HostPhrase" (
    "id" TEXT NOT NULL,
    "hostId" TEXT,
    "context" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'game',
    "lang" TEXT NOT NULL DEFAULT 'fr',
    "text" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HostPhrase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HostPhrase_context_lang_idx" ON "HostPhrase"("context", "lang");

-- AddForeignKey
ALTER TABLE "HostPhrase" ADD CONSTRAINT "HostPhrase_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Host"("id") ON DELETE SET NULL ON UPDATE CASCADE;
