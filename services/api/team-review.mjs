import {ApiError} from './domain.mjs';
import {PHASES} from '../../packages/shared/phases.mjs';
export function reviewSnapshot(team,phase,memberCount){
 const p=team.project;
 if(!p.submissions?.[phase])throw new ApiError(409,'TEAM_WORK_REQUIRED');
 let text;
 if(phase===1)text=p.prompt;
 if(phase===2)text=p.versions?.filter(v=>v.phase===2).at(-1)?.code;
 if(phase===3)text=[p.justification,...(p.findings??[]).map(f=>`${f.kind} · ${f.severity}\n${f.consequence}\n${f.mitigation}`)].join('\n\n');
 if(phase===4)text=[p.versions?.filter(v=>v.phase===4).at(-1)?.code,p.verification].filter(Boolean).join('\n\n');
 if(phase===5)text=[p.verdict,p.finalReason,p.publication].filter(Boolean).join('\n\n');
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
