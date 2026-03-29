#!/usr/bin/env node
/**
 * search.js - Search agency-agents index
 * 
 * Usage:
 *   node search.js --tag frontend --tag react
 *   node search.js --category engineering
 *   node search.js --query "database optimization"
 *   node search.js --list
 */

const fs = require('fs');
const path = require('path');

const INDEX_FILE = path.join(__dirname, '..', 'index.json');

function loadIndex() {
  if (!fs.existsSync(INDEX_FILE)) {
    console.error('❌ Index not found. Run build_index.js first.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
}

function parseArgs(args) {
  const result = {
    tags: [],
    category: null,
    query: null,
    list: false,
    help: false
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--tag' && args[i + 1]) {
      result.tags.push(args[++i]);
    } else if (arg === '--category' && args[i + 1]) {
      result.category = args[++i];
    } else if (arg === '--query' && args[i + 1]) {
      result.query = args[++i];
    } else if (arg === '--list') {
      result.list = true;
    } else if (arg === '--help' || arg === '-h') {
      result.help = true;
    }
  }
  
  return result;
}

function search(index, opts) {
  let results = index.agents;
  
  // Filter by category
  if (opts.category) {
    results = results.filter(a => a.category === opts.category);
  }
  
  // Filter by tags (AND logic)
  if (opts.tags.length > 0) {
    results = results.filter(a =>
      opts.tags.every(tag => a.tags.includes(tag))
    );
  }
  
  // Search by query (simple text match)
  if (opts.query) {
    const q = opts.query.toLowerCase();
    results = results.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.tags.some(t => t.includes(q))
    );
  }
  
  return results;
}

function formatAgent(agent) {
  const tags = agent.tags.length > 0 ? ` [${agent.tags.join(', ')}]` : '';
  const vibe = agent.vibe ? ` — ${agent.vibe}` : '';
  return `${agent.emoji || '  '} ${agent.name}${tags}${vibe}`;
}

function printResults(results, opts) {
  if (results.length === 0) {
    console.log('📭 No agents found matching your criteria.');
    return;
  }
  
  console.log(`\n📊 Found ${results.length} agent(s):\n`);
  
  // Group by category
  const byCategory = {};
  for (const agent of results) {
    if (!byCategory[agent.category]) {
      byCategory[agent.category] = [];
    }
    byCategory[agent.category].push(agent);
  }
  
  for (const [category, agents] of Object.entries(byCategory)) {
    console.log(`\n### ${category.toUpperCase()} (${agents.length})`);
    console.log('─'.repeat(50));
    for (const agent of agents) {
      console.log(`  ${formatAgent(agent)}`);
      if (opts.verbose) {
        console.log(`     File: ${agent.file}`);
      }
    }
  }
  
  console.log('\n💡 Tip: Use --verbose to see file paths');
  console.log('💡 Tip: Use --tag <tag> to filter by tags');
  console.log('💡 Tip: Use --category <category> to filter by category\n');
}

function printHelp() {
  console.log(`
🔍 Agency-Agents Search

Usage:
  node search.js [options]

Options:
  --tag <tag>          Filter by tag (can be used multiple times)
  --category <cat>     Filter by category (engineering, design, etc.)
  --query <text>       Search by text (name, description, tags)
  --list               List all agents
  --verbose            Show file paths
  --help, -h           Show this help

Examples:
  node search.js --tag react --tag ui
  node search.js --category engineering
  node search.js --query "database"
  node search.js --list
  node search.js --category design --verbose
`);
}

function main() {
  const args = process.argv.slice(2);
  const opts = parseArgs(args);
  
  if (opts.help) {
    printHelp();
    return;
  }
  
  const index = loadIndex();
  
  if (opts.list) {
    printResults(index.agents, opts);
    return;
  }
  
  const results = search(index, opts);
  printResults(results, opts);
}

main();
