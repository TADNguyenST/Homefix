CREATE TABLE "blogs" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "image_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "author_id" INTEGER NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blogs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "blogs_slug_key" ON "blogs"("slug");

ALTER TABLE "blogs"
ADD CONSTRAINT "blogs_author_id_fkey"
FOREIGN KEY ("author_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
