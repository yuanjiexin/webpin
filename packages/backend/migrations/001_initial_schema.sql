-- WebPin 初始数据库结构

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name         VARCHAR(255) NOT NULL,
  avatar_url   TEXT,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 项目表（每个项目对应一个网站或批注集合）
CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  api_key     VARCHAR(64) UNIQUE NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 批注表
CREATE TABLE IF NOT EXISTS annotations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES users(id) ON DELETE SET NULL,

  -- 目标页面
  target_url  VARCHAR(2048) NOT NULL,

  -- 元素定位（W3C Web Annotation 风格，存多个 fallback）
  selector_xpath      TEXT,
  selector_css        TEXT,
  selector_text_quote TEXT,
  -- 元素在视口中的位置（用于定位批注 Pin）
  element_rect        JSONB,

  -- 批注内容
  content     TEXT NOT NULL,
  color       VARCHAR(7) NOT NULL DEFAULT '#FFE082',
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,

  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 批注回复表
CREATE TABLE IF NOT EXISTS annotation_replies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annotation_id UUID REFERENCES annotations(id) ON DELETE CASCADE,
  author_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  content       TEXT NOT NULL,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_annotations_project ON annotations(project_id);
CREATE INDEX IF NOT EXISTS idx_annotations_author ON annotations(author_id);
CREATE INDEX IF NOT EXISTS idx_annotations_url ON annotations(target_url);
CREATE INDEX IF NOT EXISTS idx_replies_annotation ON annotation_replies(annotation_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_api_key ON projects(api_key);
