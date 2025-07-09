/*
  Warnings:

  - A unique constraint covering the columns `[baseQuestionId,type,sourceModel,text]` on the table `FanoutQuestion` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "FanoutQuestion_baseQuestionId_type_sourceModel_text_key" ON "FanoutQuestion"("baseQuestionId", "type", "sourceModel", "text");
