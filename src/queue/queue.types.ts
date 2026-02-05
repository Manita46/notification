export type ConsumeHandler = (ctx: {
  raw: string;
  body: any | null;
  ack: () => void;
  nack: (requeue?: boolean) => void;
}) => Promise<void> | void;
