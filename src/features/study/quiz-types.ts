export interface QuizQuestion {
  question: string;
  options: [string, string, string, string];
}

export interface QuizAnswer {
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
}

export interface QuizReviewItem extends QuizAnswer {
  selectedIndex: number;
}

export interface GeneratedQuiz {
  token: string;
  questions: QuizQuestion[];
}
