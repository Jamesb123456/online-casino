import React from 'react';

/**
 * Rules content schema for game "How it works" modals.
 *
 * The renderer produces JSX equivalent to what each `client/src/games/<game>/rules.jsx`
 * file currently emits: a list of `<section>` elements, each containing an `<h4>`
 * heading followed by paragraphs / unordered or ordered lists. Tables and labelled
 * examples are also supported so B7.2 can express richer content if needed.
 *
 * @typedef {Object} RulesParagraphBlock
 * @property {'paragraph'} type
 * @property {string} text
 *
 * @typedef {Object} RulesListBlock
 * @property {'list'} type
 * @property {string[]} items
 * @property {boolean} [ordered] When true, render as `<ol>` instead of `<ul>`.
 *
 * @typedef {Object} RulesTableBlock
 * @property {'table'} type
 * @property {string[]} columns
 * @property {Array<Array<string | number>>} rows
 * @property {string} [caption]
 *
 * @typedef {Object} RulesExampleBlock
 * @property {'example'} type
 * @property {string} label
 * @property {string} content
 *
 * @typedef {RulesParagraphBlock | RulesListBlock | RulesTableBlock | RulesExampleBlock} RulesBlock
 *
 * @typedef {Object} RulesSection
 * @property {string} heading Title rendered as an `<h4>`.
 * @property {RulesBlock[]} blocks Ordered content blocks inside the section.
 *
 * @typedef {Object} RulesData
 * @property {string} [title] Optional document-level title (not normally rendered;
 *   the modal already shows the game name).
 * @property {RulesSection[]} sections
 */

const HEADING_CLASS = 'text-text-primary font-semibold mb-1';
const LIST_CLASS = 'list-disc list-inside space-y-1';
const ORDERED_LIST_CLASS = 'list-decimal list-inside space-y-1';

/**
 * Render a single content block as JSX.
 *
 * @param {RulesBlock} block
 * @param {string | number} key
 * @returns {React.ReactNode}
 */
function renderBlock(block, key) {
  if (!block || typeof block !== 'object') return null;

  switch (block.type) {
    case 'paragraph':
      return <p key={key}>{block.text}</p>;

    case 'list': {
      const items = Array.isArray(block.items) ? block.items : [];
      if (block.ordered) {
        return (
          <ol key={key} className={ORDERED_LIST_CLASS}>
            {items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ol>
        );
      }
      return (
        <ul key={key} className={LIST_CLASS}>
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    }

    case 'table': {
      const columns = Array.isArray(block.columns) ? block.columns : [];
      const rows = Array.isArray(block.rows) ? block.rows : [];
      return (
        <div key={key} className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-border rounded-md">
            {block.caption ? (
              <caption className="text-xs text-text-muted text-left mb-1">{block.caption}</caption>
            ) : null}
            <thead className="bg-bg-base/60">
              <tr>
                {columns.map((col, i) => (
                  <th key={i} scope="col" className="px-2 py-1 font-semibold text-text-primary">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="border-t border-border">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-2 py-1">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case 'example':
      return (
        <p key={key}>
          <span className="font-semibold text-text-primary">{block.label}: </span>
          <span>{block.content}</span>
        </p>
      );

    default:
      return null;
  }
}

/**
 * Render a `RulesData` object into JSX matching the structure each per-game
 * `rules.jsx` currently emits. Designed to be a drop-in replacement so that
 * B7.3 can swap `RulesModal`'s `children` prop for data-driven rendering
 * without visual diff.
 *
 * @param {RulesData} data
 * @returns {React.ReactElement | null}
 */
export function renderRules(data) {
  if (!data || !Array.isArray(data.sections)) return null;

  return (
    <>
      {data.sections.map((section, sIdx) => {
        if (!section || typeof section !== 'object') return null;
        const blocks = Array.isArray(section.blocks) ? section.blocks : [];
        return (
          <section key={sIdx}>
            <h4 className={HEADING_CLASS}>{section.heading}</h4>
            {blocks.map((block, bIdx) => renderBlock(block, bIdx))}
          </section>
        );
      })}
    </>
  );
}

export default renderRules;
