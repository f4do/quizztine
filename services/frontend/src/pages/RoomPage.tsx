import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import { AppHostPresenter } from "../components/host";
import Card from "../components/ui/Card";
import { useRoomGame } from "../lib/useRoomGame";
import RoomPreGame from "../components/room/RoomPreGame";
import RoomGame from "../components/room/RoomGame";
import RoomScoreboard from "../components/room/RoomScoreboard";
import RoomReady from "../components/room/RoomReady";

export default function RoomPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const roomId = id!;

  const game = useRoomGame(roomId);

  if (game.error) {
    return (
      <Layout>
        <div className="max-w-md mx-auto mt-16 text-center">
          <Card className="rounded-3xl p-8 animate-pop-in">
            <p className="text-red-600 dark:text-red-400 mb-6 font-medium">
              {game.error}
            </p>
            <button
              onClick={() => navigate("/")}
              className="text-tv-red dark:text-tv-gold hover:underline font-bold"
            >
              {t("room.back_home")}
            </button>
          </Card>
        </div>
        <AppHostPresenter
          message={t("host.error.message")}
          expression="console"
          variant="error"
          position="bottom-right"
          avatarSize="md"
          typing={true}
        />
      </Layout>
    );
  }

  if (!game.room) {
    return (
      <Layout>
        <div className="text-center text-gray-500 dark:text-gray-400 mt-16 animate-fade-in-up">
          {t("room.loading")}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        {game.phase === "pre-game" && (
          <RoomPreGame
            room={game.room}
            phase={game.phase}
            nickname={game.nickname}
            setNickname={game.setNickname}
            playerId={game.playerId}
            joined={game.joined}
            joining={game.joining}
            soloStarting={game.soloStarting}
            creatorPid={game.creatorPid}
            handleJoin={game.handleJoin}
            handleStart={game.handleStart}
            handleSoloStart={game.handleSoloStart}
          />
        )}

        {(game.phase === "game" || game.isFeedback) && (
          <RoomGame
            phase={game.phase}
            questionId={game.questionId}
            questionIndex={game.questionIndex}
            totalQuestions={game.room.total_questions}
            questionText={game.questionText}
            questionChoices={game.questionChoices}
            questionMediaUrl={game.questionMediaUrl}
            questionMediaType={game.questionMediaType}
            questionExplanation={game.questionExplanation}
            questionSourceUrl={game.questionSourceUrl}
            questionDifficulty={game.questionDifficulty}
            questionCorrectCount={game.questionCorrectCount}
            selectedChoices={game.selectedChoices}
            choiceCorrect={game.choiceCorrect}
            hasAnswered={game.hasAnswered}
            isFeedback={game.isFeedback}
            feedbackCountdown={game.feedbackCountdown}
            timeLeft={game.timeLeft}
            timer={game.room.timer}
            result={game.result}
            feedbackMeta={game.feedbackMeta}
            answeredCount={game.answeredCount}
            totalActive={game.totalActive}
            roomMode={game.room.mode}
            handleChoice={game.handleChoice}
            handleAnswerSubmit={game.handleAnswerSubmit}
            getChoiceStyle={game.getChoiceStyle}
          />
        )}

        {game.phase === "end" && (
          <RoomScoreboard
            scoreboard={game.scoreboard}
            roomMode={game.room.mode}
            creatorPid={game.creatorPid}
            playerId={game.playerId}
            isReplaying={game.isReplaying}
            onPlayAgain={game.handlePlayAgain}
            onHome={() => navigate("/")}
          />
        )}

        {game.phase === "ready" && (
          <RoomReady
            room={game.room}
            readyPlayers={game.readyPlayers}
            isReady={game.isReady}
            creatorPid={game.creatorPid}
            playerId={game.playerId}
            onToggleReady={game.handleToggleReady}
            onStart={game.handleStart}
            onHome={() => navigate("/")}
          />
        )}
      </div>

      <AppHostPresenter
        message={game.hostMessage}
        expression={game.hostExpression}
        variant={
          game.phase === "feedback"
            ? game.result?.correct
              ? "success"
              : "error"
            : game.phase === "end" &&
                game.scoreboard[0]?.player_id === game.playerId
              ? "success"
              : "default"
        }
        position="bottom-right"
        avatarSize="lg"
        typing={true}
        key={`${game.phase}-${game.questionIndex}-${game.scoreboard.map((s) => s.score).join(",")}`}
      />
    </Layout>
  );
}
