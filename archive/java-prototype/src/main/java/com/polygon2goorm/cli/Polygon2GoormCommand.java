package com.polygon2goorm.cli;

import com.polygon2goorm.common.AppException;
import picocli.CommandLine;
import picocli.CommandLine.Command;

@Command(
        name = "polygon2goorm",
        mixinStandardHelpOptions = true,
        version = "polygon2goorm 0.1.0",
        description = "Inspect and convert v1-compatible Polygon FULL packages for goorm upload.",
        subcommands = {InspectCommand.class, ConvertCommand.class}
)
public class Polygon2GoormCommand implements Runnable {
    @Override
    public void run() {
        CommandLine.usage(this, System.out);
    }

    public static void main(String[] args) {
        CommandLine commandLine = new CommandLine(new Polygon2GoormCommand());
        commandLine.setExecutionExceptionHandler((ex, cmd, parseResult) -> {
            if (ex instanceof AppException) {
                cmd.getErr().println(ex.getMessage());
                return 1;
            }
            throw ex;
        });
        int exitCode = commandLine.execute(args);
        System.exit(exitCode);
    }
}
