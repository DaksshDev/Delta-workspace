export interface Entity {
  id: string;
  type: string;
  createdAt: number;
  updatedAt: number;
}

export interface Component {
  entityId: string;
  type: string;
  data: any;
}

export interface TitleComponent extends Component { type: 'title'; data: { title: string } }
export interface ContentComponent extends Component { type: 'content'; data: { content: string } }
export interface TagComponent extends Component { type: 'tag'; data: { tags: string[] } }
export interface FolderComponent extends Component { type: 'folder'; data: { folderId: string } }
export interface StatusComponent extends Component { type: 'status'; data: { status: string } }
export interface PriorityComponent extends Component { type: 'priority'; data: { priority: string } }
export interface MetadataComponent extends Component { type: 'metadata'; data: Record<string, any> }
export interface ColorComponent extends Component { type: 'color'; data: { color: string } }
export interface RelationComponent extends Component { type: 'relation'; data: { relations: { type: string; targetId: string }[] } }

export const ENTITY_TYPES = {
  STUDY_FOLDER: 'study_folder',
  IDEA: 'idea',
  TODO: 'todo',
  SUBJECT: 'subject',
  CHAPTER: 'chapter',
  FLASHCARD: 'flashcard',
  KEY_POINT: 'key_point',
  QUIZ: 'quiz',
  NOTE: 'note',
  VIDEO: 'video',
  EXAM_SET: 'exam_set',
  NAME_IDEA: 'name_idea',
  WHITEBOARD: 'whiteboard',
  GOAL: 'goal',
  TIMER_SESSION: 'timer_session',
  BUG: 'bug'
};
