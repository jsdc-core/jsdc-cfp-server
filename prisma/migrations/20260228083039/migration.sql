-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "supported_languages" TEXT[],
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_contents" (
    "id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "lang" VARCHAR(15) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,

    CONSTRAINT "activity_contents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "activities_slug_key" ON "activities"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "activity_contents_activity_id_lang_key" ON "activity_contents"("activity_id", "lang");

-- AddForeignKey
ALTER TABLE "activity_contents" ADD CONSTRAINT "activity_contents_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
