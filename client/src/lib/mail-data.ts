export type MailItem = {
  id: string;
  sender: string;
  subject: string;
  preview: string;
  time: string;
  unread?: boolean;
  code?: string;
  body?: string;
  links?: Array<{ label: string; url: string }>;
  starred?: boolean;
  archived?: boolean;
  trashed?: boolean;
};

export const initialMails: MailItem[] = [];
