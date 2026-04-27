import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { SearchSystem } from "@/ecs/systems";
import { FileText, Search } from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<any[]>([]);
  const setLocation = useNavigate();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  React.useEffect(() => {
    const search = async () => {
      if (query.length > 1) {
        const res = await SearchSystem.search(query);
        setResults(res);
      } else {
        setResults([]);
      }
    };
    search();
  }, [query]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput 
        placeholder="Type a command or search..." 
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {results.length > 0 && (
          <CommandGroup heading="Entities">
            {results.map((r, i) => (
              <CommandItem 
                key={i}
                onSelect={() => {
                  setOpen(false);
                  // routing logic depends on type
                  if (r.entity.type === 'idea') setLocation('/ideas');
                  else if (r.entity.type === 'todo') setLocation('/todos');
                }}
              >
                <FileText className="mr-2 h-4 w-4" />
                <span>{r.title}</span>
                <span className="ml-auto text-xs text-muted-foreground">{r.entity.type}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => { setLocation("/"); setOpen(false); }}>
            Go to Dashboard
          </CommandItem>
          <CommandItem onSelect={() => { setLocation("/todos"); setOpen(false); }}>
            Go to Todos
          </CommandItem>
          <CommandItem onSelect={() => { setLocation("/ideas"); setOpen(false); }}>
            Go to Ideas
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
