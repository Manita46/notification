export type ConsumeHandlerArgs = {
  raw: string;              
  body: any;              
  properties: Record<string, any>; 
  fields: Record<string, any>;     
  ack: () => void;           
  nack: (requeue?: boolean) => void; 
};

export type ConsumeHandler = (args: ConsumeHandlerArgs) => Promise<void> | void;
