import type { ChartData, Content } from '@omnicanvas/canvas';

function ChartView({ data }: { data: ChartData }) {
  const max = Math.max(1, ...data.values);
  const barWidth = 100 / Math.max(1, data.values.length);
  return (
    <figure className="tabular flex flex-col gap-1">
      <svg viewBox="0 0 100 60" role="img" aria-label={data.title} className="h-32 w-full">
        {data.values.map((value, i) => {
          const height = (Math.max(0, value) / max) * 50;
          return (
            <g key={i}>
              <rect
                x={i * barWidth + barWidth * 0.15}
                y={55 - height}
                width={barWidth * 0.7}
                height={height}
                className={i === data.values.length - 1 ? 'fill-accent' : 'fill-fg'}
              >
                <title>{`${data.labels[i] ?? ''}: ${value}`}</title>
              </rect>
              <text
                x={i * barWidth + barWidth / 2}
                y={59}
                textAnchor="middle"
                className="fill-muted text-[4px]"
              >
                {data.labels[i]}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="text-sm font-semibold">{data.title}</figcaption>
    </figure>
  );
}

export function ContentView({ content, assetUrl }: { content: Content; assetUrl: string | null }) {
  switch (content.kind) {
    case 'text':
      return (
        <div>
          <h3 className="text-sm font-semibold">{content.data.title}</h3>
          <p className="whitespace-pre-wrap text-sm text-muted">{content.data.body}</p>
        </div>
      );
    case 'chart':
      return <ChartView data={content.data} />;
    case 'table':
      return (
        <table className="tabular w-full text-left text-sm">
          <caption className="text-left font-semibold">{content.data.title}</caption>
          <thead>
            <tr>
              {content.data.columns.map((column, i) => (
                <th key={i} className="border-b border-line py-1 pr-2">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {content.data.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} className="py-1 pr-2 text-muted">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case 'image':
      return (
        <figure className="flex flex-col gap-1">
          {assetUrl ? (
            // Blob URL in memoria: niente ottimizzazione delle immagini di Next.
            <img
              src={assetUrl}
              alt={content.data.alt}
              className="max-h-64 w-full rounded-tile object-contain"
            />
          ) : (
            <div className="flex h-32 items-center justify-center rounded-tile bg-bg text-sm text-muted">
              Immagine in arrivo…
            </div>
          )}
          <figcaption className="text-sm font-medium">{content.data.title}</figcaption>
        </figure>
      );
  }
}
