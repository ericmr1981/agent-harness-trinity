#!/usr/bin/env node
/**
 * build_index.js - Generate index.json from agency-agents .md files
 * 
 * Parses frontmatter from all agent files and creates a searchable index.
 */

const fs = require('fs');
const path = require('path');

const AGENTS_ROOT = path.join(__dirname, '..', 'agents');
const OUTPUT_FILE = path.join(__dirname, '..', 'index.json');

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  
  const lines = match[1].split('\n');
  const frontmatter = {};
  
  for (const line of lines) {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      const value = valueParts.join(':').trim().replace(/^["']|["']$/g, '');
      frontmatter[key.trim()] = value;
    }
  }
  
  return frontmatter;
}

function extractTagsFromDescription(desc) {
  const tagKeywords = [
    'react', 'vue', 'angular', 'svelte', 'frontend', 'backend', 'api',
    'database', 'sql', 'nosql', 'cloud', 'aws', 'azure', 'gcp',
    'devops', 'ci/cd', 'security', 'testing', 'mobile', 'ios', 'android',
    'ui', 'ux', 'design', 'brand', 'visual', 'research',
    'ml', 'ai', 'data', 'pipeline', 'etl'
  ];
  
  const lower = desc.toLowerCase();
  return tagKeywords.filter(k => lower.includes(k));
}

function processDirectory(dir, category) {
  const agents = [];
  
  if (!fs.existsSync(dir)) {
    console.warn(`Directory not found: ${dir}`);
    return agents;
  }
  
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const frontmatter = parseFrontmatter(content);
    
    if (!frontmatter) {
      console.warn(`No frontmatter: ${file}`);
      continue;
    }
    
    const id = file.replace('.md', '');
    const description = frontmatter.description || '';
    
    agents.push({
      id: `${category}-${id}`,
      name: frontmatter.name || id,
      category: category,
      file: `agents/${category}/${file}`,
      description: description,
      tags: extractTagsFromDescription(description),
      emoji: frontmatter.emoji || '',
      vibe: frontmatter.vibe || '',
      when_to_use: extractWhenToUse(content),
      deliverables: extractDeliverables(content)
    });
  }
  
  return agents;
}

function extractWhenToUse(content) {
  const match = content.match(/### When to Use[\s\S]*?(?=\n##|\n###|$)/);
  if (match) {
    return match[0].replace('### When to Use', '').trim();
  }
  return '';
}

function extractDeliverables(content) {
  const match = content.match(/### Technical Deliverables[\s\S]*?(?=\n##|\n###|$)/);
  if (match) {
    const lines = match[0].split('\n').filter(l => l.trim().startsWith('-'));
    return lines.slice(0, 5).map(l => l.replace(/^\s*-\s*/, '').trim());
  }
  return [];
}

function buildIndex() {
  console.log('Building agency-agents index...');
  
  const allAgents = [];
  const categories = [];
  const tagIndex = {};
  
  // Process each category
  const categoryDirs = fs.readdirSync(AGENTS_ROOT);
  
  for (const category of categoryDirs) {
    const categoryPath = path.join(AGENTS_ROOT, category);
    if (!fs.statSync(categoryPath).isDirectory()) continue;
    
    categories.push(category);
    console.log(`Processing ${category}...`);
    
    const agents = processDirectory(categoryPath, category);
    allAgents.push(...agents);
    
    // Build tag index
    for (const agent of agents) {
      for (const tag of agent.tags) {
        if (!tagIndex[tag]) tagIndex[tag] = [];
        tagIndex[tag].push(agent.id);
      }
    }
  }
  
  const index = {
    version: '1.0.0',
    generated: new Date().toISOString(),
    source: 'https://github.com/ericmr1981/agency-agents',
    total_agents: allAgents.length,
    categories: categories,
    agents: allAgents.sort((a, b) => a.id.localeCompare(b.id)),
    tag_index: tagIndex
  };
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(index, null, 2));
  console.log(`\n✅ Index generated: ${OUTPUT_FILE}`);
  console.log(`📊 Total agents: ${allAgents.length}`);
  console.log(`📁 Categories: ${categories.join(', ')}`);
  console.log(`🏷️ Tags: ${Object.keys(tagIndex).length}`);
}

buildIndex();
