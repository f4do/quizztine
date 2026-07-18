import { useTranslation } from "react-i18next";
import QuestionForm from "../components/QuestionForm";
import Card from "../components/ui/Card";

export default function AdminQuestionCreatePage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl text-tv-red dark:text-tv-gold uppercase tracking-wide">
        {t("admin.questions.new_question")}
      </h1>
      <Card className="rounded-3xl p-6">
        <QuestionForm mode="create" />
      </Card>
    </div>
  );
}
