import {ApiError} from './domain.mjs';
import {deliverableText} from './deliverables.mjs';
import {PHASES} from '../../packages/shared/phases.mjs';
import {isDelivered} from '../../packages/shared/projects.mjs';
export function reviewSnapshot(team,phase,memberCount){
 const p=team.project;
 if(!isDelivered(p.deliverables?.[phase]))throw new ApiError(409,'TEAM_WORK_REQUIRED');
 let text=deliverableText(p,phase);
 if(!text)throw new ApiError(409,'TEAM_WORK_REQUIRED');
 const pages=[];
 while(text.length>1100||text.split('\n').length>14){
  const lineEnd=[...text.matchAll(/\n/g)][13]?.index;
  const boundary=text.lastIndexOf(' ',1100);
  const end=lineEnd!==undefined&&lineEnd<=1100?lineEnd:boundary>600?boundary:1100;
  pages.push(text.slice(0,end));text=text.slice(end).trimStart();
 }
 pages.push(text);
 return {teamId:team.id,teamName:team.name,memberCount,phase,title:PHASES[phase-1].title,pages,page:0};
}
