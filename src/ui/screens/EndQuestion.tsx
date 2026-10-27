// Frage „Weiterspielen oder Spiel beenden?“: wenn der Erste fertig ist (121, Doppelfeld, SPEC 7.4/7.7)
// oder der Sieger feststeht und um die weiteren Plätze gespielt werden kann (SPEC 5.0).

export function EndQuestion({
  title,
  text,
  continueLabel = 'Weiterspielen',
  onEnd,
  onContinue,
  onUndo,
}: {
  title: string;
  text: string;
  continueLabel?: string;
  onEnd: () => void;
  onContinue: () => void;
  onUndo: () => void;
}) {
  return (
    <div class="modal-backdrop">
      <div class="modal" role="dialog" aria-label="Weiterspielen?">
        <header class="modal-head">
          <h2>{title}</h2>
        </header>
        <div class="modal-body">
          <p>{text}</p>
          <button class="btn btn-primary" onClick={onContinue}>
            {continueLabel}
          </button>
          <button class="btn" onClick={onEnd}>
            Spiel beenden
          </button>
          <button class="btn" onClick={onUndo}>
            ↶ Rückgängig (Dart falsch eingegeben)
          </button>
        </div>
      </div>
    </div>
  );
}

/** Texte, wenn der Erste fertig ist und die anderen noch nicht (121, Doppelfeld). */
export function firstDoneQuestion(done: string[]) {
  return {
    title: `✓ ${done.join(', ')} ${done.length > 1 ? 'sind' : 'ist'} fertig`,
    text: 'Weiterspielen, bis alle fertig sind, oder das Spiel jetzt beenden? Beim Beenden zählt, was bis jetzt geschafft ist.',
  };
}
