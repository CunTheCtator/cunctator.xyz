"use client";

type Props = {
  uuid: string;
  title: string;
};

export default function DocumentViewer({ uuid, title }: Props) {
  return (
    <iframe
      src={`/uploads/${uuid}.html`}
      sandbox="allow-scripts"
      title={title}
      className="rd-frame"
    />
  );
}
