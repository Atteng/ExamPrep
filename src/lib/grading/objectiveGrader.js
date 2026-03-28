function normalizeAnswer(ans) {
  return String(ans ?? "").replace(/^[A-D]\.\s*/i, "").trim();
}

function optionByLetter(options, letter) {
  if (!Array.isArray(options) || options.length < 2) return null;
  const idx = letter.toUpperCase().charCodeAt(0) - "A".charCodeAt(0);
  if (idx < 0 || idx >= options.length) return null;
  return String(options[idx] ?? "");
}

function normalizeWithOptions(value, options) {
  const v = String(value ?? "").trim();
  if (/^[A-D]$/i.test(v)) {
    const opt = optionByLetter(options, v);
    if (opt) return normalizeAnswer(opt);
  }
  return normalizeAnswer(v);
}

function normalizeSentence(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[.,!?;:'"()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Grade TOEFL objective tasks (Reading MCQ, Listening MCQ sets, Writing "Build a Sentence", Reading "Complete The Words").
 *
 * Returns null for subjective tasks (Speaking/Writing free response) so callers can route to AI/rubrics.
 *
 * @param {{section:string, taskType:string, question:any, userAnswer:any}} submission
 * @returns {{questionId:string, score:number, feedback:string, details:any} | null}
 */
function gradeObjectiveSubmission(submission) {
  const { section, taskType, question, userAnswer } = submission;

  const isObjectiveSection =
    ["reading", "listening"].includes(section) ||
    (section === "writing" && (taskType === "Build a Sentence" || taskType === "build_sentence"));

  if (!isObjectiveSection) return null;

  // Build a Sentence: compare normalized sentence order while ignoring case/punctuation noise.
  if (taskType === "Build a Sentence" || taskType === "build_sentence") {
    const target = question?.structure?.example?.target_sentence || question?.answerKey || "";
    const cleanUser = normalizeSentence(userAnswer);
    const cleanTarget = normalizeSentence(target);
    const isCorrect = cleanUser !== "" && cleanUser === cleanTarget;
    return {
      questionId: question.id,
      score: isCorrect ? 100 : 0,
      feedback: isCorrect ? "Correct!" : `Incorrect. The correct sentence was: "${target}"`,
      details: {
        rawScore: isCorrect ? 1 : 0,
        maxScore: 1,
        normalizedUserAnswer: cleanUser,
        normalizedTargetAnswer: cleanTarget,
      },
    };
  }

  // Complete The Words: partial scoring.
  if (taskType === "Complete The Words" || taskType === "complete_words") {
    const userParts = String(userAnswer)
      .split(",")
      .map((s) => s.trim().toLowerCase());

    const answerParts = [];
    const matches = Array.from(String(question?.answerKey ?? "").matchAll(/\(\d+\)\s*(\w+)/g));
    for (const match of matches) answerParts.push(match[1].toLowerCase());

    let correctCount = 0;
    const total = answerParts.length;
    answerParts.forEach((correct, idx) => {
      if (userParts[idx] === correct) correctCount += 1;
    });

    const pct = total > 0 ? (correctCount / total) * 100 : 0;
    return {
      questionId: question.id,
      score: Math.round(pct),
      feedback: `You got ${correctCount} out of ${total} correct.`,
      details: {
        rawScore: correctCount,
        maxScore: total,
        userAnswers: userParts,
        correctAnswers: answerParts,
      },
    };
  }

  // Listening passage sets: grade each sub-question, then aggregate percent.
  if (Array.isArray(question?.questions) && question.questions.length > 0) {
    let userMap = {};
    try {
      if (typeof userAnswer === "string" && userAnswer.startsWith("{")) userMap = JSON.parse(userAnswer);
      else userMap = { 0: String(userAnswer) };
    } catch {
      userMap = { 0: String(userAnswer) };
    }

    const totalSub = question.questions.length;
    let correctSub = 0;
    const subResults = [];

    question.questions.forEach((subQ, idx) => {
      const userVal = normalizeWithOptions(userMap[idx] ?? userMap[String(idx)] ?? "", subQ.options);
      const keyVal = normalizeWithOptions(subQ.answerKey ?? subQ.answer ?? "", subQ.options);
      const isSubCorrect = userVal !== "" && keyVal !== "" && userVal === keyVal;
      if (isSubCorrect) correctSub += 1;
      subResults.push({ id: idx, status: isSubCorrect ? "correct" : "incorrect", user: userVal, correct: keyVal });
    });

    return {
      questionId: question.id,
      score: totalSub > 0 ? Math.round((correctSub / totalSub) * 100) : 0,
      feedback: `You got ${correctSub} out of ${totalSub} questions correct.`,
      details: { rawScore: correctSub, maxScore: totalSub, subQuestions: subResults },
    };
  }

  // Standard single MCQ: compare normalized (letter mapped to option-text when possible).
  const cleanKey = normalizeWithOptions(question?.answerKey, question?.options);
  const cleanUser = normalizeWithOptions(userAnswer, question?.options);
  const isCorrect = cleanUser === cleanKey;

  return {
    questionId: question.id,
    score: isCorrect ? 100 : 0,
    feedback: isCorrect ? "Correct!" : `Incorrect. The correct answer was: ${cleanKey}`,
    details: { rawScore: isCorrect ? 1 : 0, maxScore: 1 },
  };
}

module.exports = {
  gradeObjectiveSubmission,
};
