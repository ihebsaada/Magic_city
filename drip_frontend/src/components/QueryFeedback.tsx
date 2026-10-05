export function QueryFeedback({ loading, error, hasData = false, onRetry }: {
  loading?: boolean;
  error?: boolean;
  hasData?: boolean;
  onRetry: () => void;
}) {
  if (error) return (
    <div role="alert" className="my-4 rounded-sm border p-4 text-sm">
      <p>{hasData ? "Aggiornamento non riuscito. I dati visualizzati potrebbero non essere aggiornati." : "Impossibile caricare i dati. Controlla la connessione."}</p>
      <button type="button" onClick={onRetry} className="mt-2 underline">Riprova</button>
    </div>
  );
  if (loading) return <p role="status" className="py-4 text-sm text-muted-foreground">{hasData ? "Aggiornamento..." : "Caricamento..."}</p>;
  return null;
}
