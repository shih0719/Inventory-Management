import { marked } from 'marked';
// The manual lives in docs/ so it is updated in the same commit as the feature it describes.
import manualMd from '../../../docs/user-manual.md?raw';

// Our own file, parsed once at load; gfm (tables) is on by default.
const manualHtml = marked.parse(manualMd, { async: false });

export function ManualPage() {
  return <article className="manual" dangerouslySetInnerHTML={{ __html: manualHtml }} />;
}
