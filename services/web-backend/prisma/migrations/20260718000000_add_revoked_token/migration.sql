CREATE TABLE "RevokedToken" (
    id TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RevokedToken_pkey" PRIMARY KEY (id)
);
CREATE UNIQUE INDEX "RevokedToken_tokenHash_key" ON "RevokedToken"("tokenHash");
CREATE INDEX "RevokedToken_tokenHash_idx" ON "RevokedToken"("tokenHash");
CREATE INDEX "RevokedToken_expiresAt_idx" ON "RevokedToken"("expiresAt");
